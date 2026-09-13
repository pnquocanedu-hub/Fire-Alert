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