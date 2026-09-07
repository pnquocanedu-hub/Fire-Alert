#ifndef SENSORS_H
#define SENSORS_H

#include <Arduino.h>

// =====================================================
// DỮ LIỆU CẢM BIẾN
// =====================================================

extern volatile int gasValue;
extern volatile float tempValue;
extern volatile bool flameDetected;
extern volatile bool mq2Ready;
extern volatile bool sensorError;

// =====================================================
// HÀM
// =====================================================

void initSensors();

void Task_ReadSensors(void *pvParameters);

#endif