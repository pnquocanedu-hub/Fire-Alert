#include "Sensors.h"
#include "Config.h"

#include <OneWire.h>
#include <DallasTemperature.h>

// =====================================================
// DS18B20
// =====================================================

OneWire oneWire(PIN_DS18B20);
DallasTemperature ds18b20(&oneWire);

// =====================================================
// DỮ LIỆU CẢM BIẾN
// =====================================================

volatile int gasValue = 0;
volatile float tempValue = 0.0;
volatile bool flameDetected = false;
volatile bool mq2Ready = false;
volatile bool sensorError = false;

// =====================================================
// THỜI GIAN KHỞI ĐỘNG
// =====================================================

unsigned long systemStartTime = 0;

// =====================================================
// KHỞI TẠO CẢM BIẾN
// =====================================================

void initSensors()
{
    systemStartTime = millis();

    ds18b20.begin();

    pinMode(PIN_GAS, INPUT);
    pinMode(PIN_FLAME, INPUT);
}

// =====================================================
// TASK ĐỌC CẢM BIẾN
// =====================================================

void Task_ReadSensors(void *pvParameters)
{
    unsigned long lastWarmupMessage = 0;
    float emaGas = 0.0f;
    bool firstGasSample = true;
    int flameConfirmCounter = 0;
    int dsFailCount = 0;

    for (;;)
    {
        unsigned long now = millis();

        // =================================================
        // MQ-2 WARM-UP
        // =================================================

        if (!mq2Ready)
        {
            unsigned long elapsed = now - systemStartTime;

            if (elapsed >= MQ2_WARMUP_TIME)
            {
                mq2Ready = true;

                Serial.println("[MQ-2] Warm-up completed!");
            }
            else
            {
                if (now - lastWarmupMessage >= 10000)
                {
                    lastWarmupMessage = now;

                    unsigned long remaining =
                        (MQ2_WARMUP_TIME - elapsed) / 1000;

                    Serial.print("[MQ-2] Warming up... ");
                    Serial.print(remaining);
                    Serial.println("s remaining");
                }
            }
        }

        // =================================================
        // ĐỌC MQ-2 (LẤY MẪU + BỘ LỌC SỐ MŨ EMA)
        // =================================================

        long gasSum = 0;

        for (int i = 0; i < GAS_SAMPLE_COUNT; i++)
        {
            gasSum += analogRead(PIN_GAS);

            vTaskDelay(pdMS_TO_TICKS(10));
        }

        float instantAvg = (float)gasSum / GAS_SAMPLE_COUNT;

        if (firstGasSample)
        {
            emaGas = instantAvg;
            firstGasSample = false;
        }
        else
        {
            emaGas = (GAS_EMA_ALPHA * instantAvg) + ((1.0f - GAS_EMA_ALPHA) * emaGas);
        }

        gasValue = (int)(emaGas + 0.5f);

        // =================================================
        // KY-026 (XÁC NHẬN ĐA MẪU CHỐNG BÁO GIẢ)
        // =================================================

        bool rawFlame = (digitalRead(PIN_FLAME) == FLAME_DETECTED);

        if (rawFlame)
        {
            flameConfirmCounter++;
            if (flameConfirmCounter >= FLAME_CONFIRM_COUNT)
            {
                flameDetected = true;
                flameConfirmCounter = FLAME_CONFIRM_COUNT; // Tránh tràn số
            }
        }
        else
        {
            flameConfirmCounter = 0;
            flameDetected = false;
        }

        // =================================================
        // DS18B20 (ĐỌC NHIỆT ĐỘ + GIÁM SÁT LỖI)
        // =================================================

        ds18b20.requestTemperatures();
        float newTemp = ds18b20.getTempCByIndex(0);

        if (newTemp != DEVICE_DISCONNECTED_C)
        {
            tempValue = newTemp;
            dsFailCount = 0;
            sensorError = false;
        }
        else
        {
            dsFailCount++;
            if (dsFailCount >= 3)
            {
                sensorError = true;
                Serial.println("[SENSOR ERROR] DS18B20 read failed repeatedly!");
            }
        }

        // =================================================
        // SERIAL LOGGING
        // =================================================

        Serial.print("[SENSOR] ");

        Serial.print("Gas ADC: ");
        Serial.print(gasValue);

        Serial.print(" | Temp: ");
        if (sensorError)
        {
            Serial.print("ERR (");
            Serial.print(tempValue, 1);
            Serial.print(" C)");
        }
        else
        {
            Serial.print(tempValue, 1);
            Serial.print(" C");
        }

        Serial.print(" | Flame: ");

        if (flameDetected)
        {
            Serial.print("CO LUA");
        }
        else
        {
            Serial.print("KHONG LUA");
        }

        Serial.print(" | MQ2: ");

        if (mq2Ready)
        {
            Serial.println("READY");
        }
        else
        {
            Serial.println("WARMING");
        }

        // =================================================
        // CHU KỲ ĐỌC
        // =================================================

        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}