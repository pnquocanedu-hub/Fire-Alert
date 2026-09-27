#include <Arduino.h>
#include <esp_task_wdt.h>

#include "Config.h"
#include "Sensors.h"
#include "SystemLogic.h"
#include "OutputControl.h"
#include "FirebaseManager.h"

// =====================================================
// CAU HINH TASK WATCHDOG
//
// Chi giam sat IDLE cua Core 1 (cac task thoi gian thuc).
// Bo qua IDLE cua Core 0 vi Firebase/SSL chan CPU rat lau.
// =====================================================

static void setupWatchdog()
{
#if ESP_IDF_VERSION_MAJOR >= 5

  // ESP32 Arduino core 3.x (ESP-IDF 5.x)
  esp_task_wdt_config_t wdtConfig = {};

  wdtConfig.timeout_ms = 10000;        // Thoi gian cho toi da 10 giay
  wdtConfig.idle_core_mask = (1 << 1); // Chi giam sat IDLE cua Core 1
  wdtConfig.trigger_panic = true;      // Reset thiet bi neu that su bi treo

  if (esp_task_wdt_reconfigure(&wdtConfig) == ESP_OK)
  {
    Serial.println("[SYSTEM] WDT: chi giam sat Core 1 (bo qua Core 0)");
  }
  else
  {
    Serial.println("[SYSTEM] WDT: cau hinh lai that bai!");
  }

#else

  // ESP32 Arduino core 2.x (ESP-IDF 4.x)
  disableCore0WDT();

  Serial.println("[SYSTEM] WDT: da tat cho IDLE0 (Core 0)");

#endif
}

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
  // CAU HINH LAI TASK WATCHDOG
  //
  // Thu vien Firebase ESP Client thuc hien bat tay SSL/TLS
  // va cac giao dich HTTPS chan CPU lien tuc nhieu giay,
  // khien IDLE0 khong kip reset watchdog -> ESP32 tu abort:
  //   "task_wdt: Task watchdog got triggered ... IDLE0 (CPU 0)"
  //
  // KHONG dung disableCore0WDT() tren ESP32 core 3.x:
  // ham do chi xoa IDLE0 khoi danh sach giam sat nhung khong
  // go idle hook, nen hook van goi esp_task_wdt_reset() tren
  // task da bi xoa -> spam log "esp_task_wdt_reset: task not found".
  //
  // Cach dung: cau hinh lai watchdog chi giam sat IDLE cua Core 1.
  // Core 1 chua cac task thoi gian thuc (cam bien, logic, output)
  // nen phan an toan chay VAN duoc watchdog bao ve day du.
  // =================================================

  setupWatchdog();

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
  // Stack 12288 bytes: bat tay SSL/TLS + FirebaseJson ton nhieu stack,
  // 8192 de bi tran stack khi tai nang -> tang len cho an toan
  xTaskCreatePinnedToCore(
    Task_Firebase,
    "FirebaseTask",
    12288,
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

