#include <Arduino.h>

#include "Config.h"
#include "Sensors.h"
#include "SystemLogic.h"
#include "OutputControl.h"
#include "FirebaseManager.h"

// =====================================================
// SETUP
// =====================================================

void setup() {
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
  // TẠO TASK - DUAL CORE ESP32
  // =================================================

  // =================================================
  // CORE 1: REAL-TIME TASKS
  // =================================================

  // Output Control - Priority 4 (Cao nhất)
  xTaskCreatePinnedToCore(
    Task_OutputControl,
    "OutputControl",
    2048,
    NULL,
    4,
    NULL,
    1
  );

  // Logic Control - Priority 3
  xTaskCreatePinnedToCore(
    Task_LogicControl,
    "LogicControl",
    2048,
    NULL,
    3,
    NULL,
    1
  );

  // Read Sensors - Priority 2
  xTaskCreatePinnedToCore(
    Task_ReadSensors,
    "ReadSensors",
    2048,
    NULL,
    2,
    NULL,
    1
  );

  // =================================================
  // CORE 0: WIFI + FIREBASE
  // =================================================

  // Firebase Task - Priority 1
  // Stack 8192 bytes cho SSL/TLS
  xTaskCreatePinnedToCore(
    Task_Firebase,
    "FirebaseTask",
    8192,
    NULL,
    1,
    NULL,
    0
  );

  Serial.println("[SYSTEM] All tasks created");
}

// =====================================================
// LOOP
// =====================================================

void loop() {
  // Không sử dụng loop().
  // Hệ thống chạy bằng FreeRTOS.

  vTaskDelay(pdMS_TO_TICKS(1000));
}

