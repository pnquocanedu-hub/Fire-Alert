# 🔥 Hệ Thống Báo Cháy Thông Minh IoT (ESP32 + FreeRTOS)

Dự án Hệ thống báo cháy và cảnh báo rò rỉ khí Gas thông minh, ứng dụng vi điều khiển **ESP32**, hệ điều hành thời gian thực **FreeRTOS** và đồng bộ dữ liệu thời gian thực lên **Firebase**.

## 📑 Mục lục
- [Phần 1: Tổng quan Hệ thống (System Overview)](#phần-1-tổng-quan-hệ-thống-system-overview)
- [Phần 2: Thiết kế Phần cứng (Hardware Design)](#phần-2-thiết-kế-phần-cứng-hardware-design)
- [Phần 3: Cấu trúc Phần mềm & Mã nguồn (Software & Codebase)](#phần-3-cấu-trúc-phần-mềm--mã-nguồn-software--codebase)
- [Phần 4: Giao tiếp & Tích hợp (Communication & Integration)](#phần-4-giao-tiếp--tích-hợp-communication--integration)
- [Phần 5: Hướng dẫn Cài đặt & Triển khai (Setup & Deployment)](#phần-5-hướng-dẫn-cài-đặt--triển-khai-setup--deployment)
- [Phần 6: Xử lý sự cố & Tự động phát hiện lỗi (Troubleshooting & Auto-Diagnosis)](#phần-6-xử-lý-sự-cố--tự-động-phát-hiện-lỗi-troubleshooting--auto-diagnosis)

---

## Phần 1: Tổng quan Hệ thống (System Overview)

1. **Chức năng chính:** Giám sát nồng độ khí Gas (MQ-2), nhiệt độ/độ ẩm (DHT11), và phát hiện tia lửa (Flame Sensor). Khi có dấu hiệu nguy hiểm, hệ thống tự động hú còi, kích hoạt bơm nước/van chữa cháy (Relay) và gửi cảnh báo qua App thông qua Firebase.
2. **Nguyên lý hoạt động tổng thể:** ESP32 thu thập dữ liệu từ các cảm biến. Nếu các chỉ số vượt ngưỡng an toàn, máy trạng thái (State Machine) sẽ chuyển sang chế độ cảnh báo hoặc nguy hiểm, đồng thời điều khiển phần cứng đầu ra và lập tức cập nhật dữ liệu lên cloud.
3. **Danh sách linh kiện:**
   * Vi điều khiển: NodeMCU ESP32 (Dual-Core).
   * Cảm biến: Cảm biến khí Gas MQ-2, Cảm biến nhiệt độ DHT11, Cảm biến lửa KY-026.
   * Cảnh báo: Còi Buzzer 5V, Module Relay 1 kênh (điều khiển bơm).
   * Chỉ thị: 4 Đèn LED (Xanh, Vàng, Cam, Đỏ).

---

## Phần 2: Thiết kế Phần cứng (Hardware Design)

1. **Sơ đồ đấu nối (Pinout & Wiring):**
   | Thiết bị | Chân ESP32 | Loại tín hiệu | Ghi chú |
   | :--- | :--- | :--- | :--- |
   | **Cảm biến Gas MQ-2** | `GPIO 34` | Analog (ADC) | Nối với trở 10k xuống GND |
   | **Cảm biến Lửa** | `GPIO 35` | Digital | `HIGH` = Có lửa |
   | **Cảm biến DHT11** | `GPIO 4` | Digital | |
   | **Còi Buzzer** | `GPIO 18` | Digital Output | |
   | **Kích hoạt Relay** | `GPIO 5` | Digital Output | |
   | **Phản hồi Relay** | `GPIO 26` | Digital Input | Kiểm tra Relay có đóng thực tế không |
   | **LED Trạng thái** | `19, 21, 22, 23` | Digital Output | Xanh, Vàng, Cam, Đỏ tương ứng |

2. **Sơ đồ nguyên lý:** *(Bổ sung hình ảnh mạch thực tế hoặc bản vẽ Fritzing/Proteus vào đây nếu có)*.
3. **Yêu cầu về nguồn điện:** Hệ thống sử dụng nguồn cấp 5V qua cổng MicroUSB hoặc chân VIN của ESP32. Đảm bảo nguồn cấp có dòng đủ lớn (tối thiểu 1A - 2A).

---

## Phần 3: Cấu trúc Phần mềm & Mã nguồn (Software & Codebase)

1. **Cấu trúc code:**
   * `Config.h`: Lưu trữ toàn bộ các thông số cấu hình (WiFi, Firebase, Pinout, Ngưỡng cảnh báo).
   * `Sensors.cpp/h`: Chịu trách nhiệm khởi tạo và đọc dữ liệu từ các cảm biến.
   * `SystemLogic.cpp/h`: Chứa máy trạng thái (State Machine) quyết định mức độ nguy hiểm.
   * `OutputControl.cpp/h`: Điều khiển còi, đèn LED và Relay.
   * `FirebaseManager.cpp/h`: Quản lý kết nối WiFi và đẩy dữ liệu lên Firebase.
   * `HeThongBaoChay.ino`: File chính, khởi tạo FreeRTOS.
2. **Cách hoạt động (Luồng thực thi với FreeRTOS):** Hệ thống không dùng hàm `loop()` để tránh bị treo. ESP32 chia làm 4 Task chạy song song:
   * **Core 1:** `Task_ReadSensors` -> `Task_LogicControl` -> `Task_OutputControl` (Ưu tiên cao, đảm bảo thời gian thực).
   * **Core 0:** `Task_Firebase` (Xử lý mạng độc lập).
3. **Cách kiểm tra trạng thái (Debugging):** Cắm mạch vào máy tính, mở Serial Monitor ở Baudrate `115200` để xem log dữ liệu realtime.

---

## Phần 4: Giao tiếp & Tích hợp (Communication & Integration)

1. **Giao thức & Nền tảng:** Sử dụng WiFi và Firebase Realtime Database (RTDB). Chu kỳ đồng bộ là **10 giây/lần** (khi an toàn) và **2 giây/lần** (khi có cháy/khẩn cấp).
2. **Cấu trúc Database:** Dữ liệu lưu dưới dạng cây JSON (Key-Value).
3. **Quy ước dữ liệu (Data Dictionary):**
   * **Ngưỡng Nhiệt độ:** Cảnh báo `> 45.0 °C` | Nguy hiểm `> 50.0 °C`. (Vùng trễ - Hysteresis: `2.0 °C`).
   * **Ngưỡng Gas (ADC):** Cảnh báo `> 1700` | Nguy hiểm `> 2500`. (Vùng trễ - Hysteresis: `150`). *(Hysteresis giúp chống hiện tượng chớp tắt báo động liên tục khi giá trị dao động quanh điểm ngưỡng).*

---

## Phần 5: Hướng dẫn Cài đặt & Triển khai (Setup & Deployment)

1. **Môi trường phát triển:** Arduino IDE.
2. **Danh sách thư viện:** Thư viện `Firebase ESP Client`, thư viện `DHT sensor library` của Adafruit.
3. **Cấu hình thông số:** Mở file `Config.h` để thiết lập:
   ```cpp
   #define WIFI_SSID "Tên_WiFi_của_bạn"
   #define WIFI_PASSWORD "Mật_khẩu_WiFi"
   #define API_KEY "Firebase_Web_API_Key"
   #define DATABASE_URL "URL_của_Firebase_RTDB"
   ```

---

## Phần 6: Xử lý sự cố & Tự động phát hiện lỗi (Troubleshooting & Auto-Diagnosis)

Điểm nổi bật của hệ thống là khả năng **tự chẩn đoán (Self-test & Error Detection)** sự cố phần cứng ngay trong quá trình hoạt động:

1. **Tự động phát hiện lỗi Relay (Bơm nước/Van):** 
   * **Cách kiểm tra:** Mạch áp dụng cơ chế phản hồi vòng kín (Closed-loop feedback). Vi điều khiển xuất lệnh điều khiển bơm qua `GPIO 5`, đồng thời đọc ngược tín hiệu vật lý từ tiếp điểm của Relay về `GPIO 26`. 
   * **Bắt lỗi:** Nếu có lệnh Bật (ON) nhưng chân phản hồi trả về trạng thái Tắt (OFF), hệ thống lập tức hiểu rằng cuộn hút Relay bị hỏng hoặc dây tín hiệu bị đứt, biến `relayError` sẽ được bật lên `true` để báo về App.
2. **Phát hiện hỏng hóc Cảm biến DHT11:** 
   * **Cách kiểm tra:** DHT11 rất dễ bị treo hoặc mất tín hiệu nếu chập chờn dây dẫn. Hệ thống liên tục kiểm tra kết quả đọc.
   * **Bắt lỗi:** Hàm đọc sẽ kiểm tra tính hợp lệ `isnan()`. Nếu DHT11 không trả về dữ liệu 3 lần liên tiếp (tương đương 6 giây), hệ thống sẽ cảnh báo mất kết nối cảm biến bằng biến `sensorError = true` và in log ra Serial.
3. **Chẩn đoán Cảm biến khí Gas (MQ-2):** 
   * **Cách kiểm tra:** Cảm biến sử dụng giao tiếp Analog (ADC 12-bit). Lúc mới khởi động cần 60 giây làm nóng (`MQ2_WARMUP_TIME`), hệ thống sẽ bỏ qua dữ liệu để tránh báo giả.
   * **Bắt lỗi vật lý:** Nếu dây cáp tín hiệu Gas bị đứt hẳn, giá trị ADC thường sẽ tụt về `0`. Nếu dây bị chập nguồn, ADC sẽ max `4095`. Hệ thống có thể dùng dữ liệu này để biết cảm biến đã bị vô hiệu hóa vật lý. Ngoài ra, thuật toán *Lọc mút số mũ (EMA)* được áp dụng để loại bỏ các đỉnh nhiễu (Spike) do luồng gió tạt qua.

4. **Kịch bản ngoại lệ về Mạng (WiFi):**
   * **Mất kết nối:** Do module mạng nằm riêng trên Core 0 của vi điều khiển (FreeRTOS), nếu rớt mạng WiFi, các Core xử lý vật lý (Core 1) vẫn hoạt động hoàn toàn bình thường. Hệ thống vẫn phát hiện cháy, hú còi và bật bơm nước tại chỗ mà không bị treo.
=======

