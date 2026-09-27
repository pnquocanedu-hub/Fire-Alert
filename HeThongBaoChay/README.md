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

1. **Chức năng chính:** Giám sát nồng độ khí Gas (MQ-2), nhiệt độ (DS18B20), và phát hiện tia lửa (Flame Sensor). Khi có dấu hiệu nguy hiểm, hệ thống tự động hú còi, kích hoạt bơm nước/van chữa cháy (Relay) và gửi cảnh báo qua App thông qua Firebase.
2. **Nguyên lý hoạt động tổng thể:** ESP32 thu thập dữ liệu từ các cảm biến. Nếu các chỉ số vượt ngưỡng an toàn, máy trạng thái (State Machine) sẽ chuyển sang chế độ cảnh báo hoặc nguy hiểm, đồng thời điều khiển phần cứng đầu ra và lập tức cập nhật dữ liệu lên cloud.
3. **Danh sách linh kiện:**
   * Vi điều khiển: NodeMCU ESP32 (Dual-Core).
   * Cảm biến: Cảm biến khí Gas MQ-2, Cảm biến nhiệt độ DS18B20, Cảm biến lửa KY-026.
   * Cảnh báo: Còi Buzzer 5V, Module Relay 1 kênh (điều khiển bơm).
   * Chỉ thị: 4 Đèn LED (Xanh, Vàng, Cam, Đỏ).

---

## Phần 2: Thiết kế Phần cứng (Hardware Design)

1. **Sơ đồ đấu nối (Pinout & Wiring):**
   | Thiết bị | Chân ESP32 | Loại tín hiệu | Ghi chú |
   | :--- | :--- | :--- | :--- |
   | **Cảm biến Gas MQ-2** | `GPIO 34` | Analog (ADC) | Nối với trở 10k xuống GND |
   | **Cảm biến Lửa** | `GPIO 35` | Digital | `LOW` = Có lửa (theo `FLAME_DETECTED` trong `Config.h`) |
   | **Cảm biến DS18B20** | `GPIO 4` | Digital | Cần điện trở kéo lên 4.7kΩ nối với VCC |
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
   * `EmailManager.cpp/h`: Gửi email cảnh báo (SMTP) khi phát hiện cháy và khi hệ thống an toàn trở lại.
   * `HeThongBaoChay.ino`: File chính, khởi tạo FreeRTOS.
2. **Cách hoạt động (Luồng thực thi với FreeRTOS):** Hệ thống không dùng hàm `loop()` để tránh bị treo. ESP32 chia làm 4 Task chạy song song:
   * **Core 1:** `Task_ReadSensors` -> `Task_LogicControl` -> `Task_OutputControl` (Ưu tiên cao, đảm bảo thời gian thực).
   * **Core 0:** `Task_Firebase` (Xử lý mạng độc lập).
3. **Cách kiểm tra trạng thái (Debugging):** Cắm mạch vào máy tính, mở Serial Monitor ở Baudrate `115200` để xem log dữ liệu realtime.

---

## Phần 4: Giao tiếp & Tích hợp (Communication & Integration)

1. **Giao thức & Nền tảng:** Sử dụng WiFi và Firebase Realtime Database (RTDB). Chu kỳ đồng bộ là **10 giây/lần** (khi an toàn) và **2 giây/lần** (khi có cháy/khẩn cấp).
2. **Cấu trúc Database:** Dữ liệu lưu dưới dạng cây JSON (Key-Value).
3. **Bảng giá trị ngưỡng cảnh báo:**

   | Mức | Nhiệt độ | Khói / khí gas | Flame sensor | Trạng thái hệ thống |
   | :--- | :--- | :--- | :--- | :--- |
   | **Bình thường** | `< 45 °C` | `< 300 ppm` | Không phát hiện | `SAFE` (LED xanh) |
   | **Cảnh báo khói/khí gas** | `< 45 °C` | `300 - 1000 ppm` | Không phát hiện | `GAS_WARNING` (LED vàng) |
   | **Cảnh báo cháy - TH1** | Không xét | Không xét | Phát hiện ngọn lửa liên tục (2-3s) | `CRITICAL_DANGER` (LED đỏ) |
   | **Cảnh báo cháy - TH2** | `> 55 °C` | `> 1000 ppm` | Không phát hiện / tín hiệu không ổn định | `CRITICAL_DANGER` (LED đỏ) |
   | **Cảnh báo cháy - TH3** | `45 - 55 °C` | `300 - 1000 ppm` | Có tín hiệu không ổn định | `FIRE_WARNING` (LED cam) |

   * **Hysteresis:** Nhiệt độ `2.0 °C`, khí gas `50 ppm`. Vùng trễ giúp chống hiện tượng chớp tắt báo động liên tục khi giá trị dao động quanh điểm ngưỡng.
   * **Quy đổi ADC sang ppm:** Cảm biến MQ-2 xuất tín hiệu Analog, hệ thống tính điện trở cảm biến `Rs = (Vc - Vout) / Vout * RL` rồi quy ra nồng độ theo đường cong khói `ppm = A * (Rs/R0)^B`. Giá trị `R0` (điện trở trong không khí sạch) được **tự động hiệu chuẩn** trong 10 giây cuối của giai đoạn warm-up, nên cần bật nguồn mạch ở nơi thoáng khí, không có khói.
   * **Ba trạng thái của cảm biến lửa:** Cảm biến được lấy mẫu mỗi `100 ms`. Nếu có tín hiệu liên tục `>= 2.5 giây` thì kết luận *phát hiện ngọn lửa*; nếu có tín hiệu nhưng đứt quãng trong cửa sổ quan sát `3 giây` thì xếp vào *tín hiệu không ổn định*; còn lại là *không phát hiện*.
   * **An toàn bổ sung:** Bảng trên không quy định trường hợp nhiệt độ rất cao nhưng khói thấp (ví dụ cháy vật liệu ít sinh khói). Cờ `ENABLE_TEMP_SAFETY_FALLBACK` trong `Config.h` (mặc định `true`) sẽ kích hoạt cảnh báo cháy khi nhiệt độ `>= 55 °C` dù khí gas chưa vượt ngưỡng. Đặt `false` nếu muốn tuân thủ bảng tuyệt đối.

---

## Phần 5: Hướng dẫn Cài đặt & Triển khai (Setup & Deployment)

1. **Môi trường phát triển:** Arduino IDE.
2. **Danh sách thư viện:** Thư viện `Firebase ESP Client`, `OneWire` và `DallasTemperature`. **Không cần cài thư viện cho email** - tính năng gửi mail dùng giao thức SMTP thuần qua `WiFiClientSecure` (có sẵn trong ESP32 core), vì thư viện `ESP Mail Client` xung đột linker (`multiple definition`) với `Firebase ESP Client` do cả hai nhúng kèm một bản BearSSL riêng giống hệt nhau.
3. **Cấu hình thông số:** Mở file `Config.h` để thiết lập:
   ```cpp
   #define WIFI_SSID "Tên_WiFi_của_bạn"
   #define WIFI_PASSWORD "Mật_khẩu_WiFi"
   #define API_KEY "Firebase_Web_API_Key"
   #define DATABASE_URL "URL_của_Firebase_RTDB"

   // Email cảnh báo
   #define AUTHOR_EMAIL "email_gui@gmail.com"
   #define AUTHOR_PASSWORD "app_password_16_ky_tu"
   #define RECIPIENT_EMAIL "email_nhan@gmail.com"
   ```
4. **Lấy Mật khẩu ứng dụng (App Password) cho Gmail:**
   * Bật xác thực 2 bước (2-Step Verification) cho tài khoản Gmail dùng để gửi.
   * Truy cập https://myaccount.google.com/apppasswords, tạo mật khẩu ứng dụng mới, xoá hết dấu cách rồi dán vào `AUTHOR_PASSWORD`.
   * **Không** dùng mật khẩu đăng nhập Gmail thông thường vì Google sẽ chặn kết nối SMTP.

---

## Phần 6: Xử lý sự cố & Tự động phát hiện lỗi (Troubleshooting & Auto-Diagnosis)

Điểm nổi bật của hệ thống là khả năng **tự chẩn đoán (Self-test & Error Detection)** sự cố phần cứng ngay trong quá trình hoạt động:

1. **Tự động phát hiện lỗi Relay (Bơm nước/Van):** 
   * **Cách kiểm tra:** Mạch áp dụng cơ chế phản hồi vòng kín (Closed-loop feedback). Vi điều khiển xuất lệnh điều khiển bơm qua `GPIO 5`, đồng thời đọc ngược tín hiệu vật lý từ tiếp điểm của Relay về `GPIO 26`. 
   * **Bắt lỗi:** Nếu có lệnh Bật (ON) nhưng chân phản hồi trả về trạng thái Tắt (OFF), hệ thống lập tức hiểu rằng cuộn hút Relay bị hỏng hoặc dây tín hiệu bị đứt, biến `relayError` sẽ được bật lên `true` để báo về App.
2. **Phát hiện hỏng hóc Cảm biến DS18B20:** 
   * **Cách kiểm tra:** DS18B20 có thể bị treo hoặc mất tín hiệu nếu chập chờn dây dẫn. Hệ thống liên tục kiểm tra kết quả đọc.
   * **Bắt lỗi:** Hàm đọc sẽ kiểm tra tính hợp lệ qua giá trị trả về `DEVICE_DISCONNECTED_C` (-127°C). Nếu DS18B20 không trả về dữ liệu đúng 3 lần liên tiếp (tương đương 3 giây), hệ thống sẽ cảnh báo mất kết nối cảm biến bằng biến `sensorError = true` và in log ra Serial.
3. **Chẩn đoán Cảm biến khí Gas (MQ-2):** 
   * **Cách kiểm tra:** Cảm biến sử dụng giao tiếp Analog (ADC 12-bit). Lúc mới khởi động cần 60 giây làm nóng (`MQ2_WARMUP_TIME`), hệ thống sẽ bỏ qua dữ liệu để tránh báo giả.
   * **Bắt lỗi vật lý:** Nếu dây cáp tín hiệu Gas bị đứt hẳn, giá trị ADC thường sẽ tụt về `0`. Nếu dây bị chập nguồn, ADC sẽ max `4095`. Hệ thống có thể dùng dữ liệu này để biết cảm biến đã bị vô hiệu hóa vật lý. Ngoài ra, thuật toán *Lọc mút số mũ (EMA)* được áp dụng để loại bỏ các đỉnh nhiễu (Spike) do luồng gió tạt qua.

4. **Lỗi Task Watchdog trên Core 0 (`task_wdt: ... IDLE0 (CPU 0)`):**
   * **Hiện tượng:** ESP32 khởi động được vài chục giây rồi tự reset, Serial in ra `Task watchdog got triggered ... IDLE0 (CPU 0)` kèm `CPU 0: FirebaseTask`.
   * **Nguyên nhân:** Thư viện Firebase thực hiện bắt tay SSL/TLS và giao dịch HTTPS chặn CPU liên tục nhiều giây. Task IDLE của Core 0 không được cấp CPU để reset watchdog nên hệ thống tự abort.
   * **Cách xử lý:** Hàm `setupWatchdog()` trong `setup()` cấu hình lại watchdog để **chỉ giám sát IDLE của Core 1**. Core 1 chứa các task thời gian thực (đọc cảm biến, logic, điều khiển đầu ra) nên phần an toàn cháy **vẫn được watchdog bảo vệ đầy đủ**. Ngoài ra `Config` của Firebase được đặt các mốc timeout cụ thể và task chủ động `vTaskDelay()` sau mỗi giao dịch mạng nặng.
   * **Lưu ý về phiên bản core:** Trên ESP32 Arduino core **3.x** (ESP-IDF 5.x) phải dùng `esp_task_wdt_reconfigure()` với `idle_core_mask = (1 << 1)`. **Không dùng** `disableCore0WDT()` vì hàm này chỉ xoá IDLE0 khỏi danh sách giám sát mà không gỡ idle hook, khiến hook liên tục gọi reset trên task đã bị xoá và spam log `esp_task_wdt_reset(707): task not found` (lỗi này không gây reset, chỉ gây nhiễu Serial). Code đã tự nhận diện phiên bản qua `ESP_IDF_VERSION_MAJOR` nên vẫn tương thích ngược với core 2.x.

5. **Gửi Email cảnh báo (EmailManager):**
   * **Thời điểm gửi:** Ngay khi trạng thái chuyển sang `FIRE_WARNING` (cam) hoặc `CRITICAL_DANGER` (đỏ) lần đầu tiên. Nội dung email gồm mức cảnh báo, nhiệt độ, nồng độ ppm, trạng thái cảm biến lửa và tình trạng relay.
   * **Chống spam hộp thư:** Nếu tình trạng nguy hiểm kéo dài, hệ thống chỉ gửi lại email mỗi `EMAIL_RESEND_INTERVAL` (mặc định 5 phút/lần).
   * **Thông báo an toàn:** Khi hệ thống trở lại mức an toàn sau khi đã báo cháy, một email xác nhận sẽ được gửi (tắt bằng `EMAIL_SEND_RECOVERY_NOTICE`).
   * **Tắt tính năng:** Đặt `EMAIL_ALERT_ENABLED` thành `false` trong `Config.h` nếu chưa cấu hình SMTP, tránh làm chậm task do kết nối SMTP thất bại liên tục.
   * **Lưu ý bảo mật:** Không commit `Config.h` chứa mật khẩu ứng dụng thật lên kho mã nguồn công khai (Git). Kết nối SMTP dùng `setInsecure()` (bỏ qua xác thực chứng chỉ TLS) để đơn giản hoá cho thiết bị nhúng.

6. **Kịch bản ngoại lệ về Mạng (WiFi):**
   * **Mất kết nối:** Do module mạng nằm riêng trên Core 0 của vi điều khiển (FreeRTOS), nếu rớt mạng WiFi, các Core xử lý vật lý (Core 1) vẫn hoạt động hoàn toàn bình thường. Hệ thống vẫn phát hiện cháy, hú còi và bật bơm nước tại chỗ mà không bị treo.
