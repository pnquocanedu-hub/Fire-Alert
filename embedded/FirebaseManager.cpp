#include "FirebaseManager.h"
#include "Config.h"
#include "Sensors.h"
#include "SystemLogic.h"
#include "OutputControl.h"

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
    // =================================================
    // WIFI
    // =================================================

    WiFi.mode(WIFI_STA);

    WiFi.setAutoReconnect(true);

    WiFi.persistent(false);

    Serial.println("[WiFi] Connecting...");

    WiFi.begin(
        WIFI_SSID,
        WIFI_PASSWORD);

    unsigned long wifiStart = millis();

    while (
        WiFi.status() != WL_CONNECTED &&
        millis() - wifiStart < 15000)
    {
        Serial.print(".");

        vTaskDelay(pdMS_TO_TICKS(500));
    }

    Serial.println();

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

    // =================================================
    // USER AUTH
    // =================================================

    auth.user.email = USER_EMAIL;

    auth.user.password = USER_PASSWORD;

    config.token_status_callback = tokenStatusCallback;

    // =================================================
    // FIREBASE START
    // =================================================

    Firebase.begin(
        &config,
        &auth);

    Firebase.reconnectWiFi(true);

    Serial.println("[Firebase] Initialized");

    // =================================================
    // TIMER & STATE THEO DÕI
    // =================================================

    unsigned long lastFirebaseUpdate = 0;
    SystemState lastUploadedState = SAFE;
    bool lastUploadedRelayError = false;
    bool initialUploadDone = false;

    // =================================================
    // LOOP
    // =================================================

    for (;;)
    {
        unsigned long now = millis();

        // =================================================
        // WIFI LOST CHECK
        // =================================================

        if (WiFi.status() != WL_CONNECTED)
        {
            vTaskDelay(pdMS_TO_TICKS(500));
            continue;
        }

        // =================================================
        // FIREBASE (EVENT-DRIVEN + DYNAMIC INTERVAL)
        // =================================================

        if (Firebase.ready())
        {
            SystemState state = currentState;

            // Ép Firebase gửi ngay dữ liệu nếu trạng thái hệ thống thay đổi HOẶC trạng thái lỗi Relay thay đổi
            bool stateChanged = (state != lastUploadedState) || (relayError != lastUploadedRelayError);

            // Xác định chu kỳ gửi dữ liệu: 2s khi có cảnh báo/nguy hiểm, 10s khi an toàn
            unsigned long updateInterval = (state == SAFE)
                                               ? FIREBASE_SAFE_UPDATE_INTERVAL
                                               : FIREBASE_EMERGENCY_UPDATE_INTERVAL;

            bool timeToUpdate = (now - lastFirebaseUpdate >= updateInterval);

            // Gửi ngay nếu có sự thay đổi trạng thái (Event) hoặc đến chu kỳ định kỳ
            if (stateChanged || timeToUpdate || !initialUploadDone)
            {
                lastFirebaseUpdate = now;
                lastUploadedState = state;
                lastUploadedRelayError = relayError;
                initialUploadDone = true;

                // =============================================
                // COPY DATA
                // =============================================

                float temp = tempValue;
                int gas = gasValue;
                bool flame = flameDetected;
                bool mq2 = mq2Ready;
                bool isErr = sensorError;

                // =============================================
                // PUMP / RELAY
                // =============================================

                bool pumpStatus =
                    (state == FIRE_WARNING ||
                     state == CRITICAL_DANGER);

                // =============================================
                // JSON PAYLOAD (GOM NHÓM CÓ CẤU TRÚC)
                // =============================================

                FirebaseJson json;

                // 1. NHÓM THÔNG SỐ CẢM BIẾN (Dữ liệu thực tế)
                json.set("ThongSo_CamBien/NhietDo_C", temp);
                json.set("ThongSo_CamBien/NongDo_Gas_ADC", gas);
                json.set("ThongSo_CamBien/PhatHienLua", flame);

                // 2. NHÓM TRẠNG THÁI HỆ THỐNG (Hoạt động chung)
                json.set("TrangThai_HeThong/MucDoCanhBao", getStateString(state));
                json.set("TrangThai_HeThong/BomNuoc_Relay", pumpStatus);
                json.set("TrangThai_HeThong/Heartbeat_Uptime_ms", (double)now); // Nhịp tim để App check Offline

                // 3. NHÓM TÌNH TRẠNG SỨC KHỎE THIẾT BỊ (Dùng để bảo trì, check lỗi)
                json.set("TinhTrang_ThietBi/ESP32", "Online");

                if (isErr)
                {
                    json.set("TinhTrang_ThietBi/DHT22", "Lỗi/Mất kết nối");
                }
                else
                {
                    json.set("TinhTrang_ThietBi/DHT22", "Hoạt động");
                }

                if (!mq2)
                {
                    json.set("TinhTrang_ThietBi/MQ2", "Đang khởi động");
                }
                else if (gas <= 10)
                {
                    json.set("TinhTrang_ThietBi/MQ2", "Lỗi/Mất kết nối");
                }
                else
                {
                    json.set("TinhTrang_ThietBi/MQ2", "Hoạt động");
                }

                // Cảm biến lửa Digital, mặc định hoạt động nếu MCU vẫn sống
                json.set("TinhTrang_ThietBi/Flame", "Hoạt động");

                // Các thiết bị Output
                json.set("TinhTrang_ThietBi/Buzzer", "Hoạt động");

                if (relayError)
                {
                    json.set("TinhTrang_ThietBi/Relay", "Lỗi/Kẹt Relay");
                }
                else
                {
                    json.set("TinhTrang_ThietBi/Relay", "Hoạt động");
                }

                if (stateChanged)
                {
                    Serial.print("[Firebase EVENT] State changed to: ");
                    Serial.println(getStateString(state));
                }

                // =============================================
                // 1 REQUEST SET JSON
                // =============================================

                if (Firebase.RTDB.setJSON(&fbdo, "HeThong", &json))
                {
                    Serial.println("[Firebase] Update SUCCESS");
                }
                else
                {
                    Serial.print("[Firebase] ERROR: ");
                    Serial.println(fbdo.errorReason());
                }
            }
        }

        vTaskDelay(pdMS_TO_TICKS(100));
    }
=======
#include "FirebaseManager.h"
#include "Config.h"
#include "Sensors.h"
#include "SystemLogic.h"

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
        // =================================================
        // WIFI
        // =================================================

        WiFi.mode(WIFI_STA);

        WiFi.setAutoReconnect(true);

        WiFi.persistent(false);

        Serial.println("[WiFi] Connecting...");

        WiFi.begin(
            WIFI_SSID,
            WIFI_PASSWORD);

        unsigned long wifiStart = millis();

        while (
            WiFi.status() != WL_CONNECTED &&
            millis() - wifiStart < 15000)
        {
            Serial.print(".");

            vTaskDelay(pdMS_TO_TICKS(500));
        }

        Serial.println();

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

        // =================================================
        // USER AUTH
        // =================================================

        auth.user.email = USER_EMAIL;

        auth.user.password = USER_PASSWORD;

        config.token_status_callback = tokenStatusCallback;

        // =================================================
        // FIREBASE START
        // =================================================

        Firebase.begin(
            &config,
            &auth);

        Firebase.reconnectWiFi(true);

        Serial.println("[Firebase] Initialized");

        // =================================================
        // TIMER & STATE THEO DÕI
        // =================================================

        unsigned long lastFirebaseUpdate = 0;
        SystemState lastUploadedState = SAFE;
        bool initialUploadDone = false;

        // =================================================
        // LOOP
        // =================================================

        for (;;)
        {
            unsigned long now = millis();

            // =================================================
            // WIFI LOST CHECK
            // =================================================

            if (WiFi.status() != WL_CONNECTED)
            {
                vTaskDelay(pdMS_TO_TICKS(500));
                continue;
            }

            // =================================================
            // FIREBASE (EVENT-DRIVEN + DYNAMIC INTERVAL)
            // =================================================

            if (Firebase.ready())
            {
                SystemState state = currentState;
                bool stateChanged = (state != lastUploadedState);

                // Xác định chu kỳ gửi dữ liệu: 2s khi có cảnh báo/nguy hiểm, 10s khi an toàn
                unsigned long updateInterval = (state == SAFE)
                                                   ? FIREBASE_SAFE_UPDATE_INTERVAL
                                                   : FIREBASE_EMERGENCY_UPDATE_INTERVAL;

                bool timeToUpdate = (now - lastFirebaseUpdate >= updateInterval);

                // Gửi ngay nếu có sự thay đổi trạng thái (Event) hoặc đến chu kỳ định kỳ
                if (stateChanged || timeToUpdate || !initialUploadDone)
                {
                    lastFirebaseUpdate = now;
                    lastUploadedState = state;
                    initialUploadDone = true;

                    // =============================================
                    // COPY DATA
                    // =============================================

                    float temp = tempValue;
                    int gas = gasValue;
                    bool flame = flameDetected;
                    bool mq2 = mq2Ready;
                    bool isErr = sensorError;

                    // =============================================
                    // PUMP / RELAY
                    // =============================================

                    bool pumpStatus =
                        (state == FIRE_WARNING ||
                         state == CRITICAL_DANGER);

                    // =============================================
                    // JSON PAYLOAD
                    // =============================================

                    FirebaseJson json;

                    json.set("NhietDo", temp);
                    json.set("Gas_ADC", gas);
                    json.set("CoLua", flame);
                    json.set("MQ2_Ready", mq2);
                    json.set("LoiCamBien", isErr);
                    json.set("TrangThaiLED", getStateString(state));
                    json.set("TrangThaiBom", pumpStatus);

                    if (stateChanged)
                    {
                        Serial.print("[Firebase EVENT] State changed to: ");
                        Serial.println(getStateString(state));
                    }

                    // =============================================
                    // 1 REQUEST SET JSON
                    // =============================================

                    if (Firebase.RTDB.setJSON(&fbdo, "HeThong", &json))
                    {
                        Serial.println("[Firebase] Update SUCCESS");
                    }
                    else
                    {
                        Serial.print("[Firebase] ERROR: ");
                        Serial.println(fbdo.errorReason());
                    }
                }
            }

            vTaskDelay(pdMS_TO_TICKS(100));
        }
    }