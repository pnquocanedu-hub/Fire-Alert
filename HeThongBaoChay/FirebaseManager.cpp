
#include "FirebaseManager.h"
#include "Config.h"
#include "Sensors.h"
#include "SystemLogic.h"
#include "OutputControl.h"
#include "EmailManager.h"

#include <WiFi.h>
#include <Firebase_ESP_Client.h>

#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// =====================================================
// FIREBASE
// =====================================================

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// =====================================================
// TASK FIREBASE + WIFI
// =====================================================

void Task_Firebase(void *pvParameters)
{
    (void)pvParameters;

    // =================================================
    // WIFI
    // =================================================

    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.persistent(false);

    Serial.println("[WiFi] Connecting...");

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    unsigned long wifiStart = millis();

    while (
        WiFi.status() != WL_CONNECTED &&
        millis() - wifiStart < 15000
    )
    {
        Serial.print(".");
        vTaskDelay(pdMS_TO_TICKS(500));
    }

    Serial.println();

    // =================================================
    // KHỞI TẠO EMAIL (dùng chung kết nối WiFi ở task này)
    // =================================================

    initEmail();

    // =================================================
    // KIỂM TRA WIFI
    // =================================================

    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.println("[WiFi] Connected!");

        Serial.print("[WiFi] IP: ");
        Serial.println(WiFi.localIP());
    }
    else
    {
        Serial.println("[WiFi] Initial connection FAILED");
        Serial.println("[WiFi] System continues locally");
    }

    // =================================================
    // FIREBASE CONFIG
    // =================================================

    config.api_key = API_KEY;
    config.database_url = DATABASE_URL;

    config.token_status_callback = tokenStatusCallback;

    // -------------------------------------------------
    // GIOI HAN THOI GIAN CHO (chong treo task qua lau)
    // -------------------------------------------------

    config.timeout.serverResponse = 10 * 1000;    // Cho phan hoi server
    config.timeout.socketConnection = 10 * 1000;  // Cho ket noi socket
    config.timeout.sslHandshake = 20 * 1000;      // Cho bat tay SSL
    config.timeout.wifiReconnect = 10 * 1000;     // Cho ket noi lai WiFi

    // Giam bo dem phan hoi de tiet kiem RAM
    fbdo.setResponseSize(2048);

    // =================================================
    // ANONYMOUS AUTHENTICATION
    // =================================================

    Serial.println("[Firebase] Creating anonymous user...");

    if (Firebase.signUp(
            &config,
            &auth,
            "",
            ""
        ))
    {
        Serial.println("[Firebase] Anonymous authentication SUCCESS");
    }
    else
    {
        Serial.print("[Firebase] Anonymous authentication FAILED: ");
        Serial.println(config.signer.signupError.message.c_str());
    }

    // Nhuong CPU cho IDLE task sau thao tac mang nang
    vTaskDelay(pdMS_TO_TICKS(50));

    // =================================================
    // FIREBASE START
    // =================================================

    Firebase.begin(&config, &auth);

    Firebase.reconnectWiFi(true);

    Serial.println("[Firebase] Initialized");

    // Nhuong CPU cho IDLE task sau khi khoi tao
    vTaskDelay(pdMS_TO_TICKS(50));

    // =================================================
    // TIMER & STATE
    // =================================================

    unsigned long lastFirebaseUpdate = 0;

    SystemState lastUploadedState = SAFE;

    FlameState lastUploadedFlame = FLAME_NONE;

    bool lastUploadedRelayError = false;

    bool initialUploadDone = false;

    // =================================================
    // LOOP FIREBASE
    // =================================================

    for (;;)
    {
        unsigned long now = millis();

        // =================================================
        // WIFI LOST
        // =================================================

        if (WiFi.status() != WL_CONNECTED)
        {
            Serial.println("[WiFi] Connection lost");

            vTaskDelay(pdMS_TO_TICKS(500));

            continue;
        }

        // =================================================
        // KIỂM TRA & GỬI EMAIL CẢNH BÁO
        // (Chỉ cần WiFi, không phụ thuộc Firebase auth)
        // =================================================

        checkAndSendEmailAlert(currentState);

        // =================================================
        // FIREBASE READY
        // =================================================

      if (Firebase.ready())
{
    // =================================================
    // COPY TRẠNG THÁI HIỆN TẠI
    // =================================================

    SystemState state = currentState;
    FlameState flame = flameState;

    // =================================================
    // KIỂM TRA THAY ĐỔI
    // =================================================

    bool flameChanged =
        (flame != lastUploadedFlame);

    bool stateChanged =
        (state != lastUploadedState) ||
        (relayError != lastUploadedRelayError);

    // =================================================
    // UPDATE INTERVAL
    // =================================================

    unsigned long updateInterval =
        (state == SAFE)
            ? FIREBASE_SAFE_UPDATE_INTERVAL
            : FIREBASE_EMERGENCY_UPDATE_INTERVAL;

    bool timeToUpdate =
        (now - lastFirebaseUpdate >= updateInterval);

    // =================================================
    // QUYẾT ĐỊNH GỬI
    // =================================================

    if (
        stateChanged ||
        flameChanged ||
        timeToUpdate ||
        !initialUploadDone
    )
    {
        lastFirebaseUpdate = now;

        // =============================================
        // COPY SENSOR DATA
        // =============================================

        float temp = tempValue;
        int gas = gasValue;
        float ppm = gasPPM;
        bool mq2 = mq2Ready;
        bool isErr = sensorError;

        // =============================================
        // RELAY STATUS
        // =============================================

        bool pumpStatus =
            (
                state == FIRE_WARNING ||
                state == CRITICAL_DANGER
            );

        // =============================================
        // JSON
        // =============================================

        FirebaseJson json;

        // SENSOR
        json.set(
            "ThongSo_CamBien/NhietDo_C",
            temp
        );

        json.set(
            "ThongSo_CamBien/NongDo_Gas_ppm",
            ppm
        );

        json.set(
            "ThongSo_CamBien/NongDo_Gas_ADC",
            gas
        );

        json.set(
            "ThongSo_CamBien/PhatHienLua",
            (flame == FLAME_CONFIRMED)
        );

        json.set(
            "ThongSo_CamBien/TrangThai_Lua",
            getFlameStateString(flame)
        );

        // SYSTEM
        json.set(
            "TrangThai_HeThong/MucDoCanhBao",
            getStateString(state)
        );

        json.set(
            "TrangThai_HeThong/BomNuoc_Relay",
            pumpStatus
        );

        json.set(
            "TrangThai_HeThong/Heartbeat_Uptime_ms",
            (double)now
        );

        // DEVICE
        json.set(
            "TinhTrang_ThietBi/ESP32",
            "Online"
        );

        // DS18B20
        if (isErr)
        {
            json.set(
                "TinhTrang_ThietBi/DS18B20",
                "Loi/Mất ket noi"
            );
        }
        else
        {
            json.set(
                "TinhTrang_ThietBi/DS18B20",
                "Hoat dong"
            );
        }

        // MQ2
        if (!mq2)
        {
            json.set(
                "TinhTrang_ThietBi/MQ2",
                "Dang khoi dong"
            );
        }
        else if (gas <= 10)
        {
            json.set(
                "TinhTrang_Thiet_Bi/MQ2",
                "Loi/Mất ket noi"
            );
        }
        else
        {
            json.set(
                "TinhTrang_Thiet_Bi/MQ2",
                "Hoat dong"
            );
        }

        // FLAME
        json.set(
            "TinhTrang_ThietBi/Flame",
            "Hoat dong"
        );

        // BUZZER
        json.set(
            "TinhTrang_ThietBi/Buzzer",
            "Hoat dong"
        );

        // RELAY
        if (relayError)
        {
            json.set(
                "TinhTrang_ThietBi/Relay",
                "Loi/Ket Relay"
            );
        }
        else
        {
            json.set(
                "TinhTrang_ThietBi/Relay",
                "Hoat dong"
            );
        }

        // =============================================
        // LOG
        // =============================================

        if (flameChanged)
        {
            Serial.print("[Firebase EVENT] Flame changed: ");
            Serial.println(getFlameStateString(flame));
        }

        if (stateChanged)
        {
            Serial.print("[Firebase EVENT] State changed: ");
            Serial.println(getStateString(state));
        }

        // =============================================
        // SEND FIREBASE
        // =============================================

        Serial.println("[Firebase] Uploading data...");

        if (
            Firebase.RTDB.setJSON(
                &fbdo,
                "HeThong",
                &json
            )
        )
        {
            Serial.println(
                "[Firebase] Update SUCCESS"
            );

            // =========================================
            // CHỈ ĐÁNH DẤU SAU KHI UPLOAD THÀNH CÔNG
            // =========================================

            lastUploadedState = state;
            lastUploadedFlame = flame;
            lastUploadedRelayError = relayError;

            initialUploadDone = true;
        }
        else
        {
            Serial.print(
                "[Firebase] ERROR: "
            );

            Serial.println(
                fbdo.errorReason()
            );
        }

        vTaskDelay(pdMS_TO_TICKS(50));
    }
}
        // =================================================
        // NHƯỜNG CPU
        // =================================================

        vTaskDelay(
            pdMS_TO_TICKS(100)
        );
    }
}
