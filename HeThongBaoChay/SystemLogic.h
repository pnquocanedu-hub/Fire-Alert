#ifndef SYSTEM_LOGIC_H
#define SYSTEM_LOGIC_H

#include <Arduino.h>

// =====================================================
// TRẠNG THÁI HỆ THỐNG
// =====================================================

enum SystemState
{
    SAFE,            // Bình thường
    GAS_WARNING,     // Cảnh báo khói / khí gas
    FIRE_WARNING,    // Cảnh báo cháy
    CRITICAL_DANGER  // Phát hiện cháy
};

// =====================================================
// TRẠNG THÁI HIỆN TẠI
// =====================================================

extern volatile SystemState currentState;

// =====================================================
// HÀM
// =====================================================

const char *getStateString(SystemState state);

void Task_LogicControl(void *pvParameters);

#endif
