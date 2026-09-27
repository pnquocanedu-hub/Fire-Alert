#ifndef CONFIG_H
#define CONFIG_H

// =====================================================
// 1. WIFI & FIREBASE
// =====================================================

#define WIFI_SSID "Tren Lau"
#define WIFI_PASSWORD "trenlaune"

#define API_KEY "AIzaSyDZOELrOa9LLPWPRgOnbwTByoHd4NyIJAY"
#define DATABASE_URL "https://baochay-bc24f-default-rtdb.firebaseio.com/"

// =====================================================
// 2. LOGIC PHẦN CỨNG
// =====================================================

// Buzzer
#define BUZZER_ON HIGH
#define BUZZER_OFF LOW

// Relay
#define RELAY_ON LOW
#define RELAY_OFF HIGH

// Flame sensor
#define FLAME_DETECTED LOW

// =====================================================
// 3. GPIO
// =====================================================

#define PIN_GAS 34
#define PIN_FLAME 35
#define PIN_DS18B20 4

#define PIN_BUZZER 18

#define PIN_LED_GREEN 19
#define PIN_LED_YELLOW 21
#define PIN_LED_ORANGE 22
#define PIN_LED_RED 23

#define PIN_RELAY 5
#define PIN_RELAY_FEEDBACK 26 // Chân nhận tín hiệu phản hồi từ tiếp điểm NO của Relay

// =====================================================
// 4. NGƯỠNG HỆ THỐNG & HYSTERESIS
//
// Theo bảng giá trị ngưỡng cảnh báo:
//
//  Bình thường      : Temp < 45      | Gas < 300 ppm      | Khong co lua
//  Canh bao gas     : Temp < 45      | Gas 300-1000 ppm   | Khong co lua
//  Canh bao chay TH1: (khong xet)    | (khong xet)        | Co lua lien tuc 2-3s
//  Canh bao chay TH2: Temp > 55      | Gas > 1000 ppm     | Khong phat hien / chap chon
//  Canh bao chay TH3: Temp 45-55     | Gas 300-1000 ppm   | Tin hieu chap chon
// =====================================================

// Khí gas / khói (MQ-2, đơn vị ppm)
#define GAS_WARNING_PPM 500.0f     // Ngưỡng bắt đầu cảnh báo gas
#define GAS_DANGER_PPM 2000.0f     // Ngưỡng gas cao (dùng cho TH2)
#define GAS_HYSTERESIS_PPM 50.0f   // Vùng trễ chống rung ngưỡng gas (ppm)

// Nhiệt độ (DS18B20)
#define TEMP_WARNING_THRESHOLD 45.0f // Mốc 45°C
#define TEMP_DANGER_THRESHOLD 55.0f  // Mốc 55°C
#define TEMP_HYSTERESIS 2.0f         // Vùng trễ chống rung nhiệt độ (°C)

// An toàn bổ sung (KHÔNG có trong bảng):
// Bảng không quy định trường hợp nhiệt độ rất cao nhưng gas thấp
// (vd: cháy vật liệu ít sinh khói). Bật cờ này để vẫn báo cháy
// khi nhiệt độ >= TEMP_DANGER_THRESHOLD dù gas chưa vượt ngưỡng.
// Đặt false nếu muốn tuân thủ bảng một cách tuyệt đối.
#define ENABLE_TEMP_SAFETY_FALLBACK true

// =====================================================
// 5. LỌC TÍN HIỆU CẢM BIẾN
// =====================================================

#define MQ2_WARMUP_TIME 60000UL // Thời gian làm nóng MQ-2 (ms)
#define GAS_SAMPLE_COUNT 5      // Số mẫu ADC lấy trung bình mỗi lần đọc
#define GAS_EMA_ALPHA 0.3f      // Hệ số lọc làm mượt số mũ EMA (0.0 < alpha <= 1.0)

// -----------------------------------------------------
// THÔNG SỐ QUY ĐỔI ADC -> ppm CHO MQ-2
// -----------------------------------------------------
// Công thức: Rs = (Vc - Vout) / Vout * RL
//            ppm = A * (Rs / R0) ^ B
// R0 được tự động hiệu chuẩn trong không khí sạch ở cuối
// giai đoạn warm-up, nên cần bật nguồn mạch ở nơi thoáng khí.

#define MQ2_VCC 5.0f              // Điện áp cấp cho cảm biến MQ-2 (V)
#define MQ2_ADC_VREF 3.3f         // Điện áp tham chiếu ADC của ESP32 (V)
#define MQ2_ADC_MAX 4095.0f       // ADC 12-bit
#define MQ2_RL 10.0f              // Điện trở tải RL trên module (kΩ)
#define MQ2_CLEAN_AIR_RATIO 9.83f // Rs/R0 của MQ-2 trong không khí sạch (datasheet)

// Hệ số đường cong khói (smoke) của MQ-2
#define MQ2_PPM_A 3616.1f
#define MQ2_PPM_B -2.675f

// Thời gian lấy mẫu R0 trong không khí sạch (cuối warm-up)
#define MQ2_CALIB_WINDOW 10000UL

// -----------------------------------------------------
// NHẬN DẠNG TÍN HIỆU CẢM BIẾN LỬA (KY-026)
// -----------------------------------------------------
// - CO_LUA          : phát hiện liên tục >= FLAME_CONTINUOUS_MS
// - CHAP_CHON       : có tín hiệu nhưng đứt quãng trong cửa sổ quan sát
// - KHONG_PHAT_HIEN : không có tín hiệu nào trong cửa sổ quan sát

#define FLAME_SAMPLE_INTERVAL 100UL     // Chu kỳ lấy mẫu cảm biến lửa (ms)
#define FLAME_CONTINUOUS_MS 2500UL      // Thời gian liên tục để xác nhận có lửa (2-3s)
#define FLAME_WINDOW_MS 3000UL          // Cửa sổ quan sát để đánh giá chập chờn (ms)
#define FLAME_UNSTABLE_MIN_SAMPLES 2    // Số mẫu tối thiểu trong cửa sổ để coi là chập chờn

// =====================================================
// 6. WIFI / FIREBASE TIMER
// =====================================================

#define WIFI_RECONNECT_INTERVAL 5000UL
#define FIREBASE_SAFE_UPDATE_INTERVAL 10000UL     // Chu kỳ gửi khi hệ thống an toàn (ms)
#define FIREBASE_EMERGENCY_UPDATE_INTERVAL 2000UL // Chu kỳ gửi khi có cảnh báo/nguy hiểm (ms)

// =====================================================
// 7. EMAIL SMTP (CẢNH BÁO QUA EMAIL)
// =====================================================
// LƯU Ý: Gửi bằng giao thức SMTP thuần qua WiFiClientSecure
// (có sẵn trong ESP32 core) - KHÔNG cần cài thêm thư viện
// ESP Mail Client. Lý do: thư viện đó và Firebase ESP Client
// đều nhúng kèm 1 bản BearSSL riêng, gây lỗi linker
// "multiple definition" khi dùng chung.

// Máy chủ SMTP - Ví dụ dùng Gmail
#define SMTP_HOST "smtp.gmail.com"
#define SMTP_PORT 465 // Cổng TLS ngầm định (implicit TLS)

// Email dùng để GỬI đi (tài khoản Gmail của bạn)
#define AUTHOR_EMAIL "hethongbaochayyy@gmail.com"

// Mật khẩu ứng dụng (App Password) 16 ký tự của Gmail
// LƯU Ý: KHÔNG dùng mật khẩu đăng nhập Gmail bình thường.
// Tạo tại: https://myaccount.google.com/apppasswords (yêu cầu bật xác thực 2 bước)
#define AUTHOR_PASSWORD "udqh hlke lwbi xpav"

// Email dùng để NHẬN cảnh báo (có thể trùng với AUTHOR_EMAIL)
#define RECIPIENT_EMAIL "tindepzai14723@gmail.com"

// Bật/tắt tính năng gửi email (đặt false để tắt hoàn toàn nếu chưa cấu hình)
#define EMAIL_ALERT_ENABLED true

// Thời gian tối thiểu giữa 2 lần gửi email khi VẪN còn ở trạng thái nguy hiểm (ms)
// Chống spam hộp thư khi cháy kéo dài
#define EMAIL_RESEND_INTERVAL 300000UL // 5 phút

// Gửi email thông báo khi hệ thống trở lại AN TOÀN sau khi đã báo cháy
#define EMAIL_SEND_RECOVERY_NOTICE true

#endif