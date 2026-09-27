#include "Sensors.h"
#include "Config.h"

#include <OneWire.h>
#include <DallasTemperature.h>
#include <math.h>

// =====================================================
// DS18B20
// =====================================================

OneWire oneWire(PIN_DS18B20);
DallasTemperature ds18b20(&oneWire);

// =====================================================
// DỮ LIỆU CẢM BIẾN
// =====================================================

volatile int gasValue = 0;
volatile float gasPPM = 0.0f;
volatile float tempValue = 0.0;
volatile FlameState flameState = FLAME_NONE;
volatile bool flameDetected = false;
volatile bool mq2Ready = false;
volatile bool sensorError = false;

// =====================================================
// THỜI GIAN KHỞI ĐỘNG
// =====================================================

unsigned long systemStartTime = 0;

// =====================================================
// HIỆU CHUẨN MQ-2
// =====================================================

static float mq2R0 = 0.0f; // Điện trở cảm biến trong không khí sạch (kΩ)

// =====================================================
// KHỞI TẠO CẢM BIẾN
// =====================================================

void initSensors()
{
    systemStartTime = millis();

    ds18b20.begin();

    // Không chặn task khi chờ DS18B20 chuyển đổi nhiệt độ,
    // để vòng lặp chạy nhanh đủ cho việc lấy mẫu cảm biến lửa
    ds18b20.setWaitForConversion(false);
    ds18b20.requestTemperatures();

    pinMode(PIN_GAS, INPUT);
    pinMode(PIN_FLAME, INPUT);
}

// =====================================================
// TRẠNG THÁI LỬA -> CHUỖI
// =====================================================

const char *getFlameStateString(FlameState state)
{
    switch (state)
    {
    case FLAME_NONE:
        return "Khong phat hien";

    case FLAME_UNSTABLE:
        return "Tin hieu chap chon";

    case FLAME_CONFIRMED:
        return "Co lua lien tuc";
    }

    return "Khong xac dinh";
}

// =====================================================
// QUY ĐỔI ADC -> ĐIỆN TRỞ CẢM BIẾN Rs (kΩ)
// =====================================================

static float adcToRs(float adcAverage)
{
    float vout = adcAverage * MQ2_ADC_VREF / MQ2_ADC_MAX;

    // Tránh chia cho 0 khi dây tín hiệu đứt (ADC ~ 0)
    if (vout < 0.01f)
    {
        vout = 0.01f;
    }

    float rs = ((MQ2_VCC - vout) / vout) * MQ2_RL;

    if (rs < 0.0f)
    {
        rs = 0.0f;
    }

    return rs;
}

// =====================================================
// QUY ĐỔI Rs -> ppm (đường cong khói của MQ-2)
// =====================================================

static float rsToPPM(float rs)
{
    if (mq2R0 <= 0.0f)
    {
        return 0.0f;
    }

    float ratio = rs / mq2R0;

    if (ratio <= 0.0f)
    {
        return 0.0f;
    }

    float ppm = MQ2_PPM_A * powf(ratio, MQ2_PPM_B);

    if (ppm < 0.0f)
    {
        ppm = 0.0f;
    }

    // Chặn trên để tránh giá trị vô lý khi cảm biến chập/hỏng
    if (ppm > 10000.0f)
    {
        ppm = 10000.0f;
    }

    return ppm;
}

// =====================================================
// TASK ĐỌC CẢM BIẾN
// =====================================================

void Task_ReadSensors(void *pvParameters)
{
    (void)pvParameters;

    // -------------------------------------------------
    // BIẾN THỜI GIAN
    // -------------------------------------------------

    unsigned long lastWarmupMessage = 0;
    unsigned long lastGasRead = 0;
    unsigned long lastTempRequest = 0;
    unsigned long lastLog = 0;

    // -------------------------------------------------
    // BỘ LỌC GAS
    // -------------------------------------------------

    float emaGas = 0.0f;
    bool firstGasSample = true;

    // -------------------------------------------------
    // HIỆU CHUẨN R0
    // -------------------------------------------------

    float rsCalibSum = 0.0f;
    int rsCalibCount = 0;

    // -------------------------------------------------
    // CỬA SỔ QUAN SÁT CẢM BIẾN LỬA
    // -------------------------------------------------

    const int flameWindowSize = FLAME_WINDOW_MS / FLAME_SAMPLE_INTERVAL;
    const int flameContinuousNeeded = FLAME_CONTINUOUS_MS / FLAME_SAMPLE_INTERVAL;

    bool flameWindow[FLAME_WINDOW_MS / FLAME_SAMPLE_INTERVAL] = {false};

    int flameWindowIndex = 0;
    int flameWindowHits = 0;
    int flameConsecutive = 0;

    // -------------------------------------------------
    // DS18B20
    // -------------------------------------------------

    int dsFailCount = 0;
    bool tempRequestPending = true;

    lastTempRequest = millis();

    for (;;)
    {
        unsigned long now = millis();

        // =================================================
        // 1. CẢM BIẾN LỬA - LẤY MẪU NHANH MỖI 100 ms
        // =================================================

        bool rawFlame = (digitalRead(PIN_FLAME) == FLAME_DETECTED);

        // Cập nhật cửa sổ trượt
        if (flameWindow[flameWindowIndex])
        {
            flameWindowHits--;
        }

        flameWindow[flameWindowIndex] = rawFlame;

        if (rawFlame)
        {
            flameWindowHits++;
        }

        flameWindowIndex = (flameWindowIndex + 1) % flameWindowSize;

        // Đếm số mẫu liên tiếp
        if (rawFlame)
        {
            if (flameConsecutive < flameContinuousNeeded)
            {
                flameConsecutive++;
            }
        }
        else
        {
            flameConsecutive = 0;
        }

        // Phân loại trạng thái lửa
        FlameState newFlameState;

        if (flameConsecutive >= flameContinuousNeeded)
        {
            newFlameState = FLAME_CONFIRMED;
        }
        else if (flameWindowHits >= FLAME_UNSTABLE_MIN_SAMPLES)
        {
            newFlameState = FLAME_UNSTABLE;
        }
        else
        {
            newFlameState = FLAME_NONE;
        }

        if (newFlameState != flameState)
        {
            flameState = newFlameState;

            Serial.print("[FLAME] Trang thai: ");
            Serial.println(getFlameStateString(newFlameState));
        }

        flameDetected = (newFlameState == FLAME_CONFIRMED);

        // =================================================
        // 2. MQ-2 - ĐỌC ADC + LỌC EMA MỖI 500 ms
        // =================================================

        if (now - lastGasRead >= 500)
        {
            lastGasRead = now;

            long gasSum = 0;

            for (int i = 0; i < GAS_SAMPLE_COUNT; i++)
            {
                gasSum += analogRead(PIN_GAS);
            }

            float instantAvg = (float)gasSum / GAS_SAMPLE_COUNT;

            if (firstGasSample)
            {
                emaGas = instantAvg;
                firstGasSample = false;
            }
            else
            {
                emaGas = (GAS_EMA_ALPHA * instantAvg) +
                         ((1.0f - GAS_EMA_ALPHA) * emaGas);
            }

            gasValue = (int)(emaGas + 0.5f);

            float rs = adcToRs(emaGas);

            // -------------------------------------------
            // WARM-UP & HIỆU CHUẨN R0
            // -------------------------------------------

            if (!mq2Ready)
            {
                unsigned long elapsed = now - systemStartTime;

                // Thu thập mẫu Rs trong không khí sạch ở cuối warm-up
                if (elapsed >= (MQ2_WARMUP_TIME - MQ2_CALIB_WINDOW))
                {
                    rsCalibSum += rs;
                    rsCalibCount++;
                }

                if (elapsed >= MQ2_WARMUP_TIME)
                {
                    if (rsCalibCount > 0)
                    {
                        float rsAir = rsCalibSum / rsCalibCount;
                        mq2R0 = rsAir / MQ2_CLEAN_AIR_RATIO;
                    }

                    if (mq2R0 <= 0.0f)
                    {
                        // Không hiệu chuẩn được -> dùng giá trị dự phòng
                        mq2R0 = 10.0f;

                        Serial.println(
                            "[MQ-2] CANH BAO: Hieu chuan R0 that bai, dung gia tri mac dinh!");
                    }

                    mq2Ready = true;

                    Serial.print("[MQ-2] Warm-up hoan tat! R0 = ");
                    Serial.print(mq2R0, 2);
                    Serial.println(" kOhm");
                }
                else if (now - lastWarmupMessage >= 10000)
                {
                    lastWarmupMessage = now;

                    unsigned long remaining = (MQ2_WARMUP_TIME - elapsed) / 1000;

                    Serial.print("[MQ-2] Dang lam nong... con ");
                    Serial.print(remaining);
                    Serial.println("s");
                }
            }

            // -------------------------------------------
            // QUY ĐỔI ppm
            // -------------------------------------------

            if (mq2Ready)
            {
                gasPPM = rsToPPM(rs);
            }
            else
            {
                gasPPM = 0.0f;
            }
        }

        // =================================================
        // 3. DS18B20 - ĐỌC KHÔNG CHẶN MỖI 1 GIÂY
        // =================================================

        if (tempRequestPending && (now - lastTempRequest >= 800))
        {
            float newTemp = ds18b20.getTempCByIndex(0);

            if (newTemp != DEVICE_DISCONNECTED_C && newTemp > -100.0f)
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

                    Serial.println("[SENSOR ERROR] DS18B20 doc that bai nhieu lan!");
                }
            }

            tempRequestPending = false;
        }

        if (!tempRequestPending && (now - lastTempRequest >= 1000))
        {
            lastTempRequest = now;

            ds18b20.requestTemperatures();

            tempRequestPending = true;
        }

        // =================================================
        // 4. SERIAL LOGGING MỖI 1 GIÂY
        // =================================================

        if (now - lastLog >= 1000)
        {
            lastLog = now;

            Serial.print("[SENSOR] ");

            Serial.print("Gas: ");

            if (mq2Ready)
            {
                Serial.print(gasPPM, 0);
                Serial.print(" ppm (ADC ");
                Serial.print(gasValue);
                Serial.print(")");
            }
            else
            {
                Serial.print("WARMING (ADC ");
                Serial.print(gasValue);
                Serial.print(")");
            }

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
            Serial.println(getFlameStateString(flameState));
        }

        // =================================================
        // CHU KỲ LẤY MẪU
        // =================================================

        vTaskDelay(pdMS_TO_TICKS(FLAME_SAMPLE_INTERVAL));
    }
}
