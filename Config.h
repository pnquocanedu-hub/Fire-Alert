#ifndef CONFIG_H
#define CONFIG_H

// =====================================================
// 1. WIFI & FIREBASE
// =====================================================

#define WIFI_SSID ""
#define WIFI_PASSWORD ""

#define API_KEY ""
#define DATABASE_URL ""

#define USER_EMAIL ""
#define USER_PASSWORD ""

// =====================================================
// 2. LOGIC PHẦN CỨNG
// =====================================================

// Buzzer
#define BUZZER_ON HIGH
#define BUZZER_OFF LOW

// Relay
#define RELAY_ON HIGH
#define RELAY_OFF LOW

// Flame sensor
#define FLAME_DETECTED HIGH

// =====================================================
// 3. GPIO
// =====================================================

#define PIN_GAS 34
#define PIN_FLAME 35
#define PIN_DHT 4

#define PIN_BUZZER 18

#define PIN_LED_GREEN 19
#define PIN_LED_YELLOW 21
#define PIN_LED_ORANGE 22
#define PIN_LED_RED 23

#define PIN_RELAY 5

#define DHTTYPE DHT11

// =====================================================
// 4. NGƯỠNG HỆ THỐNG & HYSTERESIS
// =====================================================

// MQ-2 (ADC)
#define GAS_WARNING_THRESHOLD 1700
#define GAS_DANGER_THRESHOLD 2500
#define GAS_HYSTERESIS 150 // Vùng trễ chống rung gas (ADC)

// Nhiệt độ (DHT11)
#define TEMP_WARNING_THRESHOLD 45.0
#define TEMP_DANGER_THRESHOLD 50.0
#define TEMP_HYSTERESIS 2.0 // Vùng trễ chống rung nhiệt độ (°C)

// =====================================================
// 5. LỌC TÍN HIỆU CẢM BIẾN
// =====================================================

#define MQ2_WARMUP_TIME 60000UL
#define GAS_SAMPLE_COUNT 5
#define GAS_EMA_ALPHA 0.3f    // Hệ số lọc làm mượt số mũ EMA (0.0 < alpha <= 1.0)
#define FLAME_CONFIRM_COUNT 3 // Số mẫu liên tiếp để xác nhận trạng thái ngọn lửa

// =====================================================
// 6. WIFI / FIREBASE TIMER
// =====================================================

#define WIFI_RECONNECT_INTERVAL 5000UL
#define FIREBASE_SAFE_UPDATE_INTERVAL 10000UL     // Chu kỳ gửi khi hệ thống an toàn (ms)
#define FIREBASE_EMERGENCY_UPDATE_INTERVAL 2000UL // Chu kỳ gửi khi có cảnh báo/nguy hiểm (ms)

#endif