#ifndef EMAIL_MANAGER_H
#define EMAIL_MANAGER_H

#include <Arduino.h>
#include "SystemLogic.h"

// =====================================================
// KHÔNG CẦN CÀI THƯ VIỆN NGOÀI.
// Module này gửi email bằng giao thức SMTP thuần,
// qua WiFiClientSecure (đã có sẵn trong ESP32 core),
// để tránh xung đột "multiple definition" giữa
// Firebase ESP Client và ESP Mail Client (cả hai đều
// nhúng kèm 1 bản BearSSL riêng, trùng ký hiệu nhau).
// =====================================================

// =====================================================
// KHỞI TẠO EMAIL (gọi 1 lần sau khi WiFi kết nối)
// =====================================================

void initEmail();

// =====================================================
// KIỂM TRA STATE & GỬI EMAIL NẾU CẦN
// Gọi hàm này định kỳ trong Task_Firebase với state hiện tại
// =====================================================

void checkAndSendEmailAlert(SystemState state);

#endif
