#include <Arduino.h>

#include "Config.h"
#include "Sensors.h"
#include "SystemLogic.h"
#include "OutputControl.h"
#include "FirebaseManager.h"

// =====================================================
// SETUP
// =====================================================

void setup()
{
    Serial.begin(115200);
    delay(500);

    // =================================================
    // KHỞI TẠO
    // =================================================

    initSensors();
    initOutputs();

    // =================================================
    // THÔNG BÁO
    // =================================================

    Serial.println();
    Serial.println("========================================");
    Serial.println("        HE THONG BAO CHAY IoT");
    Serial.println("========================================");

    Serial.println("[SYSTEM] Started");
    Serial.println("[MQ-2] Warm-up: 60 seconds");

    // =================================================
    // TẠO TASK (GHIM CORE ĐỘC LẬP - DUAL CORE ESP32)
    // =================================================

    // CORE 1: Dành riêng cho các tác vụ thời gian thực (Real-time)
    // Output Control (Ưu tiên 4 - Cao nhất)
    xTaskCreatePinnedToCore(
        Task_OutputControl,
        "OutputControl",
        2048,
        NULL,
        4,
        NULL,
        1);

    // Logic Control (Ưu tiên 3)
    xTaskCreatePinnedToCore(
        Task_LogicControl,
        "LogicControl",
        2048,
        NULL,
        3,
        NULL,
        1);

    // Read Sensors (Ưu tiên 2)
    xTaskCreatePinnedToCore(
        Task_ReadSensors,
        "ReadSensors",
        2048,
        NULL,
        2,
        NULL,
        1);

    // CORE 0: Dành riêng cho giao thức mạng WiFi & Firebase (Non-realtime)
    // Firebase Task (Ưu tiên 1, Stack 8192 bytes cho SSL/TLS)
    xTaskCreatePinnedToCore(
        Task_Firebase,
        "FirebaseTask",
        8192,
        NULL,
        1,
        NULL,
        0);
}

// =====================================================
// LOOP
// =====================================================

void loop()
{
    // Không sử dụng loop.
    // Hệ thống chạy bằng FreeRTOS.
}