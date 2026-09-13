#include "SystemLogic.h"
#include "Config.h"
#include "Sensors.h"

// =====================================================
// TRẠNG THÁI HIỆN TẠI
// =====================================================

volatile SystemState currentState = SAFE;

// =====================================================
// STATE → STRING
// =====================================================

const char *getStateString(SystemState state)
{
    switch (state)
    {
    case SAFE:
        return "Xanh (An toàn)";

    case GAS_WARNING:
        return "Vàng (Cảnh báo Gas)";

    case FIRE_WARNING:
        return "Cam (Cảnh báo Cháy)";

    case CRITICAL_DANGER:
        return "Đỏ (Nguy hiểm)";
    }

    return "Không xác định";
}

// =====================================================
// TASK XỬ LÝ LOGIC
// =====================================================

void Task_LogicControl(void *pvParameters)
{
    // Biến cờ Hysteresis chống dao động trạng thái
    bool isGasWarningActive = false;
    bool isGasDangerActive = false;
    bool isTempWarningActive = false;
    bool isTempDangerActive = false;

    for (;;)
    {
        // =================================================
        // ĐIỀU KIỆN GAS VỚI HYSTERESIS
        // =================================================

        if (mq2Ready)
        {
            // Ngưỡng Gas Nguy hiểm (Danger)
            if (gasValue >= GAS_DANGER_THRESHOLD)
            {
                isGasDangerActive = true;
            }
            else if (gasValue < (GAS_DANGER_THRESHOLD - GAS_HYSTERESIS))
            {
                isGasDangerActive = false;
            }

            // Ngưỡng Gas Cảnh báo (Warning)
            if (gasValue >= GAS_WARNING_THRESHOLD)
            {
                isGasWarningActive = true;
            }
            else if (gasValue < (GAS_WARNING_THRESHOLD - GAS_HYSTERESIS))
            {
                isGasWarningActive = false;
            }
        }
        else
        {
            isGasWarningActive = false;
            isGasDangerActive = false;
        }

        // =================================================
        // ĐIỀU KIỆN NHIỆT ĐỘ VỚI HYSTERESIS
        // =================================================

        // Ngưỡng Nhiệt độ Nguy hiểm (Danger >= 50°C)
        if (tempValue >= TEMP_DANGER_THRESHOLD)
        {
            isTempDangerActive = true;
        }
        else if (tempValue < (TEMP_DANGER_THRESHOLD - TEMP_HYSTERESIS))
        {
            isTempDangerActive = false;
        }

        // Ngưỡng Nhiệt độ Cảnh báo (Warning >= 45°C)
        if (tempValue >= TEMP_WARNING_THRESHOLD)
        {
            isTempWarningActive = true;
        }
        else if (tempValue < (TEMP_WARNING_THRESHOLD - TEMP_HYSTERESIS))
        {
            isTempWarningActive = false;
        }

        // =================================================
        // XẾP HẠNG ƯU TIÊN TRẠNG THÁI PCCC
        // =================================================

        // ƯU TIÊN 1: CRITICAL DANGER (BÁO ĐỘNG ĐỎ)
        // - Khi phát hiện có ngọn lửa (Flame)
        // - HOẶC nhiệt độ chạm ngưỡng nguy hiểm cháy (Temp >= 50°C)
        // - HOẶC nồng độ gas cực cao kèm nhiệt độ bất thường
        if (flameDetected || isTempDangerActive || (isGasDangerActive && isTempWarningActive))
        {
            currentState = CRITICAL_DANGER;
        }

        // ƯU TIÊN 2: FIRE WARNING (CẢNH BÁO CHÁY - CAM)
        // - Khi nhiệt độ tăng cao cảnh báo (Temp >= 45°C) nhưng chưa có lửa
        else if (isTempWarningActive)
        {
            currentState = FIRE_WARNING;
        }

        // ƯU TIÊN 3: GAS WARNING (CẢNH BÁO GAS - VÀNG)
        // - Khi nồng độ gas vượt ngưỡng cảnh báo/nguy hiểm nhưng chưa có nhiệt/lửa
        else if (isGasWarningActive || isGasDangerActive)
        {
            currentState = GAS_WARNING;
        }

        // MẶC ĐỊNH: SAFE (AN TOÀN - XANH)
        else
        {
            currentState = SAFE;
        }

        vTaskDelay(pdMS_TO_TICKS(100));
    }
=======
#include "SystemLogic.h"
#include "Config.h"
#include "Sensors.h"

    // =====================================================
    // TRẠNG THÁI HIỆN TẠI
    // =====================================================

    volatile SystemState currentState = SAFE;

    // =====================================================
    // STATE → STRING
    // =====================================================

    const char *getStateString(SystemState state)
    {
        switch (state)
        {
        case SAFE:
            return "Xanh (An toàn)";

        case GAS_WARNING:
            return "Vàng (Cảnh báo Gas)";

        case FIRE_WARNING:
            return "Cam (Cảnh báo Cháy)";

        case CRITICAL_DANGER:
            return "Đỏ (Nguy hiểm)";
        }

        return "Không xác định";
    }

    // =====================================================
    // TASK XỬ LÝ LOGIC
    // =====================================================

    void Task_LogicControl(void *pvParameters)
    {
        // Biến cờ Hysteresis chống dao động trạng thái
        bool isGasWarningActive = false;
        bool isGasDangerActive = false;
        bool isTempWarningActive = false;
        bool isTempDangerActive = false;

        for (;;)
        {
            // =================================================
            // ĐIỀU KIỆN GAS VỚI HYSTERESIS
            // =================================================

            if (mq2Ready)
            {
                // Ngưỡng Gas Nguy hiểm (Danger)
                if (gasValue >= GAS_DANGER_THRESHOLD)
                {
                    isGasDangerActive = true;
                }
                else if (gasValue < (GAS_DANGER_THRESHOLD - GAS_HYSTERESIS))
                {
                    isGasDangerActive = false;
                }

                // Ngưỡng Gas Cảnh báo (Warning)
                if (gasValue >= GAS_WARNING_THRESHOLD)
                {
                    isGasWarningActive = true;
                }
                else if (gasValue < (GAS_WARNING_THRESHOLD - GAS_HYSTERESIS))
                {
                    isGasWarningActive = false;
                }
            }
            else
            {
                isGasWarningActive = false;
                isGasDangerActive = false;
            }

            // =================================================
            // ĐIỀU KIỆN NHIỆT ĐỘ VỚI HYSTERESIS
            // =================================================

            // Ngưỡng Nhiệt độ Nguy hiểm (Danger >= 50°C)
            if (tempValue >= TEMP_DANGER_THRESHOLD)
            {
                isTempDangerActive = true;
            }
            else if (tempValue < (TEMP_DANGER_THRESHOLD - TEMP_HYSTERESIS))
            {
                isTempDangerActive = false;
            }

            // Ngưỡng Nhiệt độ Cảnh báo (Warning >= 45°C)
            if (tempValue >= TEMP_WARNING_THRESHOLD)
            {
                isTempWarningActive = true;
            }
            else if (tempValue < (TEMP_WARNING_THRESHOLD - TEMP_HYSTERESIS))
            {
                isTempWarningActive = false;
            }

            // =================================================
            // XẾP HẠNG ƯU TIÊN TRẠNG THÁI PCCC
            // =================================================

            // ƯU TIÊN 1: CRITICAL DANGER (BÁO ĐỘNG ĐỎ)
            // - Khi phát hiện có ngọn lửa (Flame)
            // - HOẶC nhiệt độ chạm ngưỡng nguy hiểm cháy (Temp >= 50°C)
            // - HOẶC nồng độ gas cực cao kèm nhiệt độ bất thường
            if (flameDetected || isTempDangerActive || (isGasDangerActive && isTempWarningActive))
            {
                currentState = CRITICAL_DANGER;
            }

            // ƯU TIÊN 2: FIRE WARNING (CẢNH BÁO CHÁY - CAM)
            // - Khi nhiệt độ tăng cao cảnh báo (Temp >= 45°C) nhưng chưa có lửa
            else if (isTempWarningActive)
            {
                currentState = FIRE_WARNING;
            }

            // ƯU TIÊN 3: GAS WARNING (CẢNH BÁO GAS - VÀNG)
            // - Khi nồng độ gas vượt ngưỡng cảnh báo/nguy hiểm nhưng chưa có nhiệt/lửa
            else if (isGasWarningActive || isGasDangerActive)
            {
                currentState = GAS_WARNING;
            }

            // MẶC ĐỊNH: SAFE (AN TOÀN - XANH)
            else
            {
                currentState = SAFE;
            }

            vTaskDelay(pdMS_TO_TICKS(100));
        }
    }