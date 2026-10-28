#include "SystemLogic.h"
#include "Config.h"
#include "Sensors.h"

// =====================================================
// TRẠNG THÁI HIỆN TẠI
// =====================================================

volatile SystemState currentState = SAFE;

// =====================================================
// STATE -> STRING
// =====================================================

const char *getStateString(SystemState state)
{
    switch (state)
    {
    case SAFE:
        return "Xanh (An toàn)";

    case GAS_WARNING:
        return "Vàng (Cảnh báo khói/khí gas)";

    case FIRE_WARNING:
        return "Cam (Cảnh báo cháy)";

    case CRITICAL_DANGER:
        return "Đỏ (Phát hiện cháy)";
    }

    return "Không xác định";
}

// =====================================================
// TASK XỬ LÝ LOGIC
// =====================================================

void Task_LogicControl(void *pvParameters)
{
    (void)pvParameters;

    // -------------------------------------------------
    // CỜ HYSTERESIS CHỐNG DAO ĐỘNG QUANH NGƯỠNG
    // -------------------------------------------------

    bool gasAbove300 = false;  // Gas >= 300 ppm
    bool gasAbove1000 = false; // Gas >= 1000 ppm

    bool tempAbove45 = false; // Temp >= 45 °C
    bool tempAbove55 = false; // Temp >= 55 °C

    for (;;)
    {
        // =================================================
        // NGƯỠNG KHÍ GAS (ppm) VỚI HYSTERESIS
        // =================================================

        if (mq2Ready)
        {
            float ppm = gasPPM;

            // Ngưỡng 1000 ppm
            if (ppm >= GAS_DANGER_PPM)
            {
                gasAbove1000 = true;
            }
            else if (ppm < (GAS_DANGER_PPM - GAS_HYSTERESIS_PPM))
            {
                gasAbove1000 = false;
            }

            // Ngưỡng 300 ppm
            if (ppm >= GAS_WARNING_PPM)
            {
                gasAbove300 = true;
            }
            else if (ppm < (GAS_WARNING_PPM - GAS_HYSTERESIS_PPM))
            {
                gasAbove300 = false;
            }
        }
        else
        {
            // Chưa warm-up xong -> không tin dữ liệu gas
            gasAbove300 = false;
            gasAbove1000 = false;
        }

        // =================================================
        // NGƯỠNG NHIỆT ĐỘ VỚI HYSTERESIS
        // =================================================

        float temp = tempValue;

        // Ngưỡng 55 °C
        if (temp >= TEMP_DANGER_THRESHOLD)
        {
            tempAbove55 = true;
        }
        else if (temp < (TEMP_DANGER_THRESHOLD - TEMP_HYSTERESIS))
        {
            tempAbove55 = false;
        }

        // Ngưỡng 45 °C
        if (temp >= TEMP_WARNING_THRESHOLD)
        {
            tempAbove45 = true;
        }
        else if (temp < (TEMP_WARNING_THRESHOLD - TEMP_HYSTERESIS))
        {
            tempAbove45 = false;
        }

        // =================================================
        // TRẠNG THÁI CẢM BIẾN LỬA
        // =================================================

        FlameState flame = flameState;

        bool flameConfirmed = (flame == FLAME_CONFIRMED);
        bool flameUnstable = (flame == FLAME_UNSTABLE);

        // Vùng nhiệt độ trung gian 45 - 55 °C
        bool tempBetween45And55 = (tempAbove45 && !tempAbove55);

        // Vùng gas trung gian 300 - 1000 ppm
        bool gasBetween300And1000 = (gasAbove300 && !gasAbove1000);

        // =================================================
        // BẢNG QUYẾT ĐỊNH TRẠNG THÁI
        // =================================================

        // -------------------------------------------------
        // CẢNH BÁO CHÁY - TRƯỜNG HỢP 1 (ưu tiên cao nhất)
        // Phát hiện ngọn lửa liên tục 2-3s
        // (không xét nhiệt độ và khí gas)
        // -------------------------------------------------
        if (flameConfirmed)
        {
            currentState = CRITICAL_DANGER;
        }

        // -------------------------------------------------
        // CẢNH BÁO CHÁY - TRƯỜNG HỢP 2
        // Temp > 55 °C VÀ Gas > 1000 ppm
        // (flame không phát hiện hoặc chập chờn)
        // -------------------------------------------------
        else if (tempAbove55 && gasAbove1000)
        {
            currentState = CRITICAL_DANGER;
        }

        // -------------------------------------------------
        // CẢNH BÁO CHÁY - TRƯỜNG HỢP 3
        // Temp 45-55 °C VÀ Gas 300-1000 ppm VÀ flame chập chờn
        // -------------------------------------------------
        else if (tempBetween45And55 && gasBetween300And1000 && flameUnstable)
        {
            currentState = FIRE_WARNING;
        }

#if ENABLE_TEMP_SAFETY_FALLBACK
        // -------------------------------------------------
        // AN TOÀN BỔ SUNG (không có trong bảng)
        // Nhiệt độ >= 55 °C nhưng gas chưa cao
        // -------------------------------------------------
        else if (tempAbove55)
        {
            currentState = FIRE_WARNING;
        }
#endif

        // -------------------------------------------------
        // CẢNH BÁO KHÓI / KHÍ GAS
        // Temp < 45 °C VÀ Gas 300-1000 ppm VÀ không có lửa
        // -------------------------------------------------
        else if (!tempAbove45 && gasBetween300And1000 && (flame == FLAME_NONE))
        {
            currentState = GAS_WARNING;
        }

        // -------------------------------------------------
        // GAS RẤT CAO (> 1000 ppm) NHƯNG CHƯA ĐỦ ĐIỀU KIỆN CHÁY
        // Bảng xếp mức này vào cảnh báo khói/khí gas
        // -------------------------------------------------
        else if (gasAbove1000)
        {
            currentState = GAS_WARNING;
        }

        // -------------------------------------------------
        // CÁC TRƯỜNG HỢP CÒN LẠI CÓ TÍN HIỆU BẤT THƯỜNG NHẸ
        // (gas 300-1000 ppm kèm nhiệt độ hơi cao hoặc lửa chập chờn)
        // -------------------------------------------------
        else if (gasBetween300And1000)
        {
            currentState = GAS_WARNING;
        }

        // -------------------------------------------------
        // BÌNH THƯỜNG
        // Temp < 45 °C, Gas < 300 ppm, không phát hiện lửa
        // -------------------------------------------------
        else
        {
            currentState = SAFE;
        }

        vTaskDelay(pdMS_TO_TICKS(100));
    }
}
