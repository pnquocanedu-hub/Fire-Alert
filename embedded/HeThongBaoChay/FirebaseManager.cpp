
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

    // =================================================
    // FIREBASE START
    // =================================================

    Firebase.begin(&config, &auth);

    Firebase.reconnectWiFi(true);

    Serial.println("[Firebase] Initialized");

    // =================================================
    // TIMER & STATE
    // =================================================

    unsigned long lastFirebaseUpdate = 0;

    SystemState lastUploadedState = SAFE;

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
        // FIREBASE READY
        // =================================================

        if (Firebase.ready())
        {
            SystemState state = currentState;

            // =================================================
            // STATE CHANGE
            // =================================================

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
                timeToUpdate ||
                !initialUploadDone
            )
            {
                // ---------------------------------------------
                // UPDATE TIMER
                // ---------------------------------------------

                lastFirebaseUpdate = now;

                lastUploadedState = state;

                lastUploadedRelayError = relayError;

                initialUploadDone = true;

                // =============================================
                // COPY SENSOR DATA
                // =============================================

                float temp = tempValue;
                int gas = gasValue;
                bool flame = flameDetected;
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

                // =============================================
                // 1. SENSOR DATA
                // =============================================

                json.set(
                    "ThongSo_CamBien/NhietDo_C",
                    temp
                );

                json.set(
                    "ThongSo_CamBien/NongDo_Gas_ADC",
                    gas
                );

                json.set(
                    "ThongSo_CamBien/PhatHienLua",
                    flame
                );

                // =============================================
                // 2. SYSTEM STATUS
                // =============================================

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

                // =============================================
                // 3. DEVICE STATUS
                // =============================================

                json.set(
                    "TinhTrang_ThietBi/ESP32",
                    "Online"
                );

                // =============================================
                // DS18B20
                // =============================================

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

                // =============================================
                // MQ-2
                // =============================================

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
                        "TinhTrang_ThietBi/MQ2",
                        "Loi/Mất ket noi"
                    );
                }
                else
                {
                    json.set(
                        "TinhTrang_ThietBi/MQ2",
                        "Hoat dong"
                    );
                }

                // =============================================
                // FLAME
                // =============================================

                json.set(
                    "TinhTrang_ThietBi/Flame",
                    "Hoat dong"
                );

                // =============================================
                // BUZZER
                // =============================================

                json.set(
                    "TinhTrang_ThietBi/Buzzer",
                    "Hoat dong"
                );

                // =============================================
                // RELAY
                // =============================================

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

                if (stateChanged)
                {
                    Serial.print(
                        "[Firebase EVENT] State changed to: "
                    );

                    Serial.println(
                        getStateString(state)
                    );

                    if (relayError)
                    {
                        Serial.println(
                            "[Firebase EVENT] Relay ERROR detected"
                        );
                    }
                }

                // =============================================
                // SEND JSON
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
            }
        }
        else
        {
            // Firebase chưa lấy được token
            static unsigned long lastNotReadyLog = 0;

            if (now - lastNotReadyLog >= 5000)
            {
                lastNotReadyLog = now;

                Serial.println(
                    "[Firebase] NOT READY - waiting for authentication..."
                );
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