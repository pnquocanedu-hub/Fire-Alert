#include "EmailManager.h"
#include "Config.h"
#include "Sensors.h"
#include "OutputControl.h"

#include <WiFiClientSecure.h>

// =====================================================
// BIẾN TRẠNG THÁI GỬI EMAIL
// =====================================================

static unsigned long lastEmailSentTime = 0;

static bool alertEmailSentForThisEvent = false; // Đã gửi email cho lần cháy hiện tại chưa
static bool wasInDanger = false;                // Lần trước có đang ở trạng thái nguy hiểm không

// =====================================================
// HẰNG SỐ SMTP
// =====================================================

static const unsigned long SMTP_TIMEOUT_MS = 8000UL;

// =====================================================
// BASE64 ENCODE (tự cài đặt - không cần thư viện ngoài)
// =====================================================

static String base64Encode(const String &input)
{
    static const char *table =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "abcdefghijklmnopqrstuvwxyz"
        "0123456789+/";

    size_t len = input.length();

    String output;
    output.reserve(((len + 2) / 3) * 4);

    size_t i = 0;

    // Xử lý từng nhóm 3 byte đầy đủ
    while (i + 3 <= len)
    {
        uint32_t n =
            ((uint32_t)(uint8_t)input[i] << 16) |
            ((uint32_t)(uint8_t)input[i + 1] << 8) |
            (uint32_t)(uint8_t)input[i + 2];

        output += table[(n >> 18) & 0x3F];
        output += table[(n >> 12) & 0x3F];
        output += table[(n >> 6) & 0x3F];
        output += table[n & 0x3F];

        i += 3;
    }

    // Xử lý phần dư (1 hoặc 2 byte cuối) kèm padding '='
    size_t remaining = len - i;

    if (remaining == 1)
    {
        uint32_t n = (uint32_t)(uint8_t)input[i] << 16;

        output += table[(n >> 18) & 0x3F];
        output += table[(n >> 12) & 0x3F];
        output += "==";
    }
    else if (remaining == 2)
    {
        uint32_t n =
            ((uint32_t)(uint8_t)input[i] << 16) |
            ((uint32_t)(uint8_t)input[i + 1] << 8);

        output += table[(n >> 18) & 0x3F];
        output += table[(n >> 12) & 0x3F];
        output += table[(n >> 6) & 0x3F];
        output += "=";
    }

    return output;
}

// =====================================================
// ĐỌC 1 PHẢN HỒI SMTP (CÓ THỂ NHIỀU DÒNG)
// Trả về mã số 3 chữ số (vd 250, 334, 235), hoặc -1 nếu timeout
// =====================================================

static int readSmtpResponse(WiFiClientSecure &client)
{
    unsigned long start = millis();
    String line;
    int code = -1;

    while (millis() - start < SMTP_TIMEOUT_MS)
    {
        while (client.available())
        {
            char c = client.read();

            if (c == '\n')
            {
                if (line.length() >= 3)
                {
                    code = line.substring(0, 3).toInt();
                }

                // Dòng cuối của phản hồi có dạng "250 " (khoảng trắng),
                // các dòng trung gian (multi-line) có dạng "250-"
                if (line.length() >= 4 && line.charAt(3) == ' ')
                {
                    return code;
                }

                line = "";
            }
            else if (c != '\r')
            {
                line += c;
            }
        }

        // Nhường CPU trong lúc chờ phản hồi
        vTaskDelay(pdMS_TO_TICKS(10));
    }

    return code;
}

// =====================================================
// GỬI 1 LỆNH SMTP VÀ ĐỌC PHẢN HỒI
// =====================================================

static int sendSmtpCommand(WiFiClientSecure &client, const String &cmd)
{
    client.print(cmd);
    client.print("\r\n");
    return readSmtpResponse(client);
}

// =====================================================
// GỬI EMAIL QUA SMTP (Gmail, TLS ngầm định cổng 465)
// =====================================================

static bool sendAlertMail(const String &subject, const String &htmlBody)
{
    WiFiClientSecure client;

    // Bỏ qua xác thực chứng chỉ TLS để tránh phải nhúng CA cert
    // (đơn giản hoá cho thiết bị nhúng)
    client.setInsecure();
    client.setTimeout(10);

    Serial.println("[Email] Dang ket noi SMTP...");

    if (!client.connect(SMTP_HOST, SMTP_PORT))
    {
        Serial.println("[Email] Ket noi SMTP THAT BAI!");
        return false;
    }

    int code = readSmtpResponse(client); // Chờ lời chào 220

    if (code != 220)
    {
        Serial.println("[Email] Khong nhan duoc loi chao 220 tu server!");
        client.stop();
        return false;
    }

    if (sendSmtpCommand(client, "EHLO esp32") < 200)
    {
        Serial.println("[Email] EHLO that bai!");
        client.stop();
        return false;
    }

    if (sendSmtpCommand(client, "AUTH LOGIN") != 334)
    {
        Serial.println("[Email] AUTH LOGIN khong duoc chap nhan!");
        client.stop();
        return false;
    }

    if (sendSmtpCommand(client, base64Encode(AUTHOR_EMAIL)) != 334)
    {
        Serial.println("[Email] Gui username that bai!");
        client.stop();
        return false;
    }

    if (sendSmtpCommand(client, base64Encode(AUTHOR_PASSWORD)) != 235)
    {
        Serial.println("[Email] Dang nhap THAT BAI - kiem tra lai App Password!");
        client.stop();
        return false;
    }

    if (sendSmtpCommand(client, String("MAIL FROM:<") + AUTHOR_EMAIL + ">") != 250)
    {
        Serial.println("[Email] MAIL FROM that bai!");
        client.stop();
        return false;
    }

    if (sendSmtpCommand(client, String("RCPT TO:<") + RECIPIENT_EMAIL + ">") >= 300)
    {
        Serial.println("[Email] RCPT TO that bai!");
        client.stop();
        return false;
    }

    if (sendSmtpCommand(client, "DATA") != 354)
    {
        Serial.println("[Email] Lenh DATA that bai!");
        client.stop();
        return false;
    }

    // ---------------------------------------------------
    // NỘI DUNG EMAIL (HEADERS + BODY HTML)
    // ---------------------------------------------------

    String message;
    message += "From: He Thong Bao Chay ESP32 <" + String(AUTHOR_EMAIL) + ">\r\n";
    message += "To: " + String(RECIPIENT_EMAIL) + "\r\n";
    message += "Subject: " + subject + "\r\n";
    message += "MIME-Version: 1.0\r\n";
    message += "Content-Type: text/html; charset=UTF-8\r\n";
    message += "\r\n";
    message += htmlBody;
    message += "\r\n.\r\n"; // Kết thúc DATA

    client.print(message);

    code = readSmtpResponse(client);

    if (code != 250)
    {
        Serial.println("[Email] Gui noi dung THAT BAI!");
        client.stop();
        return false;
    }

    sendSmtpCommand(client, "QUIT");
    client.stop();

    Serial.println("[Email] Gui canh bao THANH CONG!");
    return true;
}

// =====================================================
// KHỞI TẠO
// =====================================================

void initEmail()
{
    if (!EMAIL_ALERT_ENABLED)
    {
        Serial.println("[Email] Tinh nang canh bao Email dang TAT (EMAIL_ALERT_ENABLED = false)");
        return;
    }

    Serial.println("[Email] Da khoi tao module canh bao Email (SMTP thuan)");
}

// =====================================================
// KHỐI THÔNG SỐ CẢM BIẾN DÙNG CHUNG CHO CÁC EMAIL
// =====================================================

static String buildSensorBlock()
{
    // Copy dữ liệu volatile ra biến cục bộ để chuỗi nhất quán
    float temp = tempValue;
    float ppm = gasPPM;
    int adc = gasValue;
    bool ready = mq2Ready;
    FlameState flame = flameState;

    String s;

    s += "<p><b>Nhiet do (DS18B20):</b> " + String(temp, 1) + " &deg;C</p>";

    s += "<p><b>Nong do khoi/khi gas (MQ-2):</b> ";

    if (ready)
    {
        s += String(ppm, 0) + " ppm (ADC " + String(adc) + ")";
    }
    else
    {
        s += "Dang lam nong cam bien";
    }

    s += "</p>";

    s += "<p><b>Cam bien lua (KY-026):</b> ";
    s += getFlameStateString(flame);
    s += "</p>";

    return s;
}

// =====================================================
// EMAIL BÁO CHÁY / NGUY HIỂM
// =====================================================

static void buildAndSendDangerMail(SystemState state)
{
    String subject;

    if (state == CRITICAL_DANGER)
    {
        subject = "[NGUY HIEM] Phat hien CHAY - He thong bao chay ESP32";
    }
    else
    {
        subject = "[CANH BAO] Nguy co chay - He thong bao chay ESP32";
    }

    String body;

    body += "<h2 style='color:red;'>CANH BAO HE THONG BAO CHAY</h2>";
    body += "<p><b>Muc do canh bao:</b> " + String(getStateString(state)) + "</p>";
    body += buildSensorBlock();
    body += "<p><b>Trang thai Relay/Bom nuoc:</b> " +
            String(relayError ? "LOI - KIEM TRA NGAY" : "Hoat dong binh thuong") + "</p>";
    body += "<p><i>Thoi gian hoat dong thiet bi (uptime):</i> " +
            String(millis() / 1000) + " giay</p>";
    body += "<hr><p style='font-size:12px;color:gray;'>Email tu dong tu He Thong Bao Chay IoT (ESP32).</p>";

    sendAlertMail(subject, body);
}

// =====================================================
// EMAIL BÁO ĐÃ AN TOÀN TRỞ LẠI
// =====================================================

static void buildAndSendRecoveryMail()
{
    String subject = "[AN TOAN] He thong da tro lai binh thuong - He thong bao chay ESP32";

    String body;

    body += "<h2 style='color:green;'>HE THONG DA TRO LAI AN TOAN</h2>";
    body += "<p>Cac chi so cam bien da tro ve nguong an toan.</p>";
    body += buildSensorBlock();
    body += "<hr><p style='font-size:12px;color:gray;'>Email tu dong tu He Thong Bao Chay IoT (ESP32).</p>";

    sendAlertMail(subject, body);
}

// =====================================================
// KIỂM TRA STATE & QUYẾT ĐỊNH GỬI EMAIL
// - Gọi định kỳ từ Task_Firebase với state hiện tại
// =====================================================

void checkAndSendEmailAlert(SystemState state)
{
    if (!EMAIL_ALERT_ENABLED)
    {
        return;
    }

    unsigned long now = millis();

    // Gửi email khi ở mức cảnh báo cháy hoặc phát hiện cháy
    bool isDanger = (state == FIRE_WARNING || state == CRITICAL_DANGER);

    // =================================================
    // VỪA CHUYỂN SANG TRẠNG THÁI NGUY HIỂM
    // =================================================

    if (isDanger && !wasInDanger)
    {
        Serial.println("[Email EVENT] Phat hien nguy hiem -> Gui email canh bao ngay!");

        buildAndSendDangerMail(state);

        lastEmailSentTime = now;
        alertEmailSentForThisEvent = true;
    }

    // =================================================
    // VẪN CÒN NGUY HIỂM -> GỬI LẠI ĐỊNH KỲ (chống spam)
    // =================================================

    else if (isDanger && wasInDanger)
    {
        if (now - lastEmailSentTime >= EMAIL_RESEND_INTERVAL)
        {
            Serial.println("[Email EVENT] Van con nguy hiem -> Gui lai email canh bao");

            buildAndSendDangerMail(state);

            lastEmailSentTime = now;
        }
    }

    // =================================================
    // VỪA TRỞ LẠI AN TOÀN SAU KHI ĐÃ BÁO CHÁY
    // =================================================

    else if (!isDanger && wasInDanger)
    {
        if (EMAIL_SEND_RECOVERY_NOTICE && alertEmailSentForThisEvent)
        {
            Serial.println("[Email EVENT] He thong da an toan tro lai -> Gui email thong bao");

            buildAndSendRecoveryMail();

            lastEmailSentTime = now;
        }

        alertEmailSentForThisEvent = false;
    }

    wasInDanger = isDanger;
}
