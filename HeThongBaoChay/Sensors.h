#ifndef SENSORS_H
#define SENSORS_H

#include <Arduino.h>

// =====================================================
// TRẠNG THÁI CẢM BIẾN LỬA (KY-026)
// =====================================================

enum FlameState
{
    FLAME_NONE,     // Không phát hiện tín hiệu nào
    FLAME_UNSTABLE, // Có tín hiệu nhưng chập chờn / không ổn định
    FLAME_CONFIRMED // Phát hiện ngọn lửa liên tục (2-3 giây)
};

// =====================================================
// DỮ LIỆU CẢM BIẾN
// =====================================================

extern volatile int gasValue;           // Giá trị ADC thô (dùng để chẩn đoán dây/cảm biến)
extern volatile float gasPPM;           // Nồng độ khói/khí gas quy đổi (ppm)
extern volatile float tempValue;        // Nhiệt độ (°C)
extern volatile FlameState flameState;  // Trạng thái cảm biến lửa
extern volatile bool flameDetected;     // true khi flameState == FLAME_CONFIRMED (giữ để tương thích)
extern volatile bool mq2Ready;          // MQ-2 đã warm-up và hiệu chuẩn R0 xong
extern volatile bool sensorError;       // Lỗi đọc DS18B20

// =====================================================
// HÀM
// =====================================================

void initSensors();

const char *getFlameStateString(FlameState state);

void Task_ReadSensors(void *pvParameters);

#endif
