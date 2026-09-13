#ifndef SYSTEM_LOGIC_H
#define SYSTEM_LOGIC_H

#include <Arduino.h>

// =====================================================
// TRẠNG THÁI HỆ THỐNG
// =====================================================

enum SystemState
{
    SAFE,
    GAS_WARNING,
    FIRE_WARNING,
    CRITICAL_DANGER
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