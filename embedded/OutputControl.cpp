#include "OutputControl.h"
#include "Config.h"
#include "SystemLogic.h"

// =====================================================
// KHỞI TẠO OUTPUT
// =====================================================

volatile bool relayError = false;

void initOutputs()
{
    pinMode(PIN_BUZZER, OUTPUT);

    pinMode(PIN_LED_GREEN, OUTPUT);
    pinMode(PIN_LED_YELLOW, OUTPUT);
    pinMode(PIN_LED_ORANGE, OUTPUT);
    pinMode(PIN_LED_RED, OUTPUT);

    pinMode(PIN_RELAY, OUTPUT);
    pinMode(PIN_RELAY_FEEDBACK, INPUT_PULLUP);

    digitalWrite(PIN_BUZZER, BUZZER_OFF);

    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_ORANGE, LOW);
    digitalWrite(PIN_LED_RED, LOW);

    digitalWrite(PIN_RELAY, RELAY_OFF);
}

// =====================================================
// HÀM TRỢ GIÚP ĐIỀU KHIỂN LED CÓ ĐỆM TRẠNG THÁI (TRÁNH GHI GPIO LIÊN TỤC)
// =====================================================

static void updateLeds(bool green, bool yellow, bool orange, bool red)
{
    static int lastG = -1, lastY = -1, lastO = -1, lastR = -1;

    int g = green ? HIGH : LOW;
    int y = yellow ? HIGH : LOW;
    int o = orange ? HIGH : LOW;
    int r = red ? HIGH : LOW;

    if (g != lastG)
    {
        digitalWrite(PIN_LED_GREEN, g);
        lastG = g;
    }
    if (y != lastY)
    {
        digitalWrite(PIN_LED_YELLOW, y);
        lastY = y;
    }
    if (o != lastO)
    {
        digitalWrite(PIN_LED_ORANGE, o);
        lastO = o;
    }
    if (r != lastR)
    {
        digitalWrite(PIN_LED_RED, r);
        lastR = r;
    }
}

// =====================================================
// TASK OUTPUT CONTROL
// =====================================================

void Task_OutputControl(void *pvParameters)
{
    unsigned long lastBuzzerMillis = 0;
    unsigned long lastRedLedMillis = 0;

    bool buzzerState = false;
    bool redLedState = false;

    SystemState previousState = SAFE;

    unsigned long lastPeriodicTest = 0;
    bool needBootTest = true;

    for (;;)
    {
        unsigned long now = millis();

        // =================================================
        // AUTO SELF-TEST RELAY (LÚC BOOT, MỖI 24H, HOẶC MỖI 5S NẾU ĐANG CÓ LỖI)
        // Chỉ test khi hệ thống đang SAFE
        // =================================================
        if (currentState == SAFE)
        {
            // Bình thường 24 giờ (86400000ms), nếu đang có lỗi thì 5 giây (5000ms) test 1 lần để phục hồi
            unsigned long testInterval = relayError ? 5000UL : 86400000UL;

            if (needBootTest || (now - lastPeriodicTest >= testInterval))
            {
                if (relayError)
                {
                    Serial.println("[RECOVERY] Đang kiểm tra xem Relay đã được sửa chưa...");
                }
                else
                {
                    Serial.println("[TEST] Bắt đầu tự chẩn đoán định kỳ Relay...");
                }

                // Bước 1: Ra lệnh Đóng Relay
                digitalWrite(PIN_RELAY, RELAY_ON);
                vTaskDelay(pdMS_TO_TICKS(50)); // Chờ 50ms cơ khí đóng

                bool testFailed = false;
                if (digitalRead(PIN_RELAY_FEEDBACK) == HIGH)
                {
                    Serial.println("[TEST LỖI] Relay không thể đóng (Cuộn hút hỏng / đứt cáp)!");
                    testFailed = true;
                }

                // Bước 2: Ra lệnh Mở Relay
                digitalWrite(PIN_RELAY, RELAY_OFF);
                vTaskDelay(pdMS_TO_TICKS(50)); // Chờ 50ms cơ khí mở

                if (digitalRead(PIN_RELAY_FEEDBACK) == LOW)
                {
                    Serial.println("[TEST LỖI] Relay bị kẹt/dính tiếp điểm!");
                    testFailed = true;
                }

                if (!testFailed)
                {
                    relayError = false; // Xóa lỗi nếu pass self-test
                    Serial.println("[TEST OK] Relay hoạt động hoàn hảo!");
                }
                else
                {
                    relayError = true;
                }

                lastPeriodicTest = millis();
                needBootTest = false;
                now = millis(); // Cập nhật lại now sau các lệnh delay
            }
        }

        // =================================================
        // STATE THAY ĐỔI
        // =================================================

        if (currentState != previousState)
        {
            buzzerState = false;
            redLedState = false;

            lastBuzzerMillis = now;
            lastRedLedMillis = now;

            previousState = currentState;
        }

        // =================================================
        // ĐIỀU KHIỂN ĐẦU RA THEO STATE
        // =================================================

        switch (currentState)
        {
        case SAFE:
            updateLeds(true, false, false, false);
            digitalWrite(PIN_BUZZER, BUZZER_OFF);
            digitalWrite(PIN_RELAY, RELAY_OFF);
            break;

        case GAS_WARNING:
            updateLeds(false, true, false, false);
            digitalWrite(PIN_RELAY, RELAY_OFF);

            if (now - lastBuzzerMillis >= 500)
            {
                lastBuzzerMillis = now;
                buzzerState = !buzzerState;
                digitalWrite(PIN_BUZZER, buzzerState ? BUZZER_ON : BUZZER_OFF);
            }
            break;

        case FIRE_WARNING:
            updateLeds(false, false, true, false);
            digitalWrite(PIN_RELAY, RELAY_ON);

            if (now - lastBuzzerMillis >= 100)
            {
                lastBuzzerMillis = now;
                buzzerState = !buzzerState;
                digitalWrite(PIN_BUZZER, buzzerState ? BUZZER_ON : BUZZER_OFF);
            }
            break;

        case CRITICAL_DANGER:
            if (now - lastRedLedMillis >= 100)
            {
                lastRedLedMillis = now;
                redLedState = !redLedState;
            }
            updateLeds(false, false, false, redLedState);
            digitalWrite(PIN_RELAY, RELAY_ON);
            digitalWrite(PIN_BUZZER, BUZZER_ON);
            break;
        }

        // =================================================
        // KIỂM TRA PHẢN HỒI (FEEDBACK) THỤ ĐỘNG
        // =================================================

        static unsigned long lastRelayChangeTime = 0;
        static bool lastRelayCmd = false;

        bool currentRelayCmd = (currentState == FIRE_WARNING || currentState == CRITICAL_DANGER);

        if (currentRelayCmd != lastRelayCmd)
        {
            lastRelayCmd = currentRelayCmd;
            lastRelayChangeTime = now;
        }

        if (now - lastRelayChangeTime > 50)
        {
            bool feedbackState = digitalRead(PIN_RELAY_FEEDBACK);

            if (currentRelayCmd == true && feedbackState == HIGH)
            {
                relayError = true;
            }
            else if (currentRelayCmd == false && feedbackState == LOW)
            {
                relayError = true;
            }
            else
            {
                // Nếu hệ thống đang phát lệnh BẬT (ON) mà phản hồi về đúng là BẬT (LOW),
                // chứng tỏ cuộn hút và tiếp điểm đều đang hoạt động rất tốt.
                // Ta cho phép xóa lỗi ngay lập tức (phục hồi lỗi đứt dây ngay cả khi đang có báo cháy).
                if (currentRelayCmd == true && feedbackState == LOW)
                {
                    relayError = false;
                }

                // LƯU Ý: Ta KHÔNG tự động xóa lỗi khi lệnh là TẮT (OFF) và phản hồi là HIGH.
                // Vì nếu cuộn hút bị đứt dây (chết), trạng thái đọc được mặc định luôn là OFF/HIGH.
                // Nếu xóa lỗi lúc này, sẽ đè mất kết quả phát hiện lỗi đứt dây của hàm Self-Test lúc boot.
                // Việc phục hồi lỗi ở trạng thái OFF sẽ do luồng Auto-Recovery (5 giây) đảm nhiệm.
            }
        }

        vTaskDelay(pdMS_TO_TICKS(20));
    }
=======
#include "OutputControl.h"
#include "Config.h"
#include "SystemLogic.h"

    // =====================================================
    // KHỞI TẠO OUTPUT
    // =====================================================

    void initOutputs()
    {
        pinMode(PIN_BUZZER, OUTPUT);

        pinMode(PIN_LED_GREEN, OUTPUT);
        pinMode(PIN_LED_YELLOW, OUTPUT);
        pinMode(PIN_LED_ORANGE, OUTPUT);
        pinMode(PIN_LED_RED, OUTPUT);

        pinMode(PIN_RELAY, OUTPUT);

        digitalWrite(PIN_BUZZER, BUZZER_OFF);

        digitalWrite(PIN_LED_GREEN, LOW);
        digitalWrite(PIN_LED_YELLOW, LOW);
        digitalWrite(PIN_LED_ORANGE, LOW);
        digitalWrite(PIN_LED_RED, LOW);

        digitalWrite(PIN_RELAY, RELAY_OFF);
    }

    // =====================================================
    // HÀM TRỢ GIÚP ĐIỀU KHIỂN LED CÓ ĐỆM TRẠNG THÁI (TRÁNH GHI GPIO LIÊN TỤC)
    // =====================================================

    static void updateLeds(bool green, bool yellow, bool orange, bool red)
    {
        static int lastG = -1, lastY = -1, lastO = -1, lastR = -1;

        int g = green ? HIGH : LOW;
        int y = yellow ? HIGH : LOW;
        int o = orange ? HIGH : LOW;
        int r = red ? HIGH : LOW;

        if (g != lastG)
        {
            digitalWrite(PIN_LED_GREEN, g);
            lastG = g;
        }
        if (y != lastY)
        {
            digitalWrite(PIN_LED_YELLOW, y);
            lastY = y;
        }
        if (o != lastO)
        {
            digitalWrite(PIN_LED_ORANGE, o);
            lastO = o;
        }
        if (r != lastR)
        {
            digitalWrite(PIN_LED_RED, r);
            lastR = r;
        }
    }

    // =====================================================
    // TASK OUTPUT CONTROL
    // =====================================================

    void Task_OutputControl(void *pvParameters)
    {
        unsigned long lastBuzzerMillis = 0;
        unsigned long lastRedLedMillis = 0;

        bool buzzerState = false;
        bool redLedState = false;

        SystemState previousState = SAFE;

        for (;;)
        {
            unsigned long now = millis();

            // =================================================
            // STATE THAY ĐỔI
            // =================================================

            if (currentState != previousState)
            {
                buzzerState = false;
                redLedState = false;

                lastBuzzerMillis = now;
                lastRedLedMillis = now;

                previousState = currentState;
            }

            // =================================================
            // ĐIỀU KHIỂN ĐẦU RA THEO STATE
            // =================================================

            switch (currentState)
            {
                // =================================================
                // SAFE (AN TOÀN)
                // =================================================

            case SAFE:

                updateLeds(true, false, false, false);
                digitalWrite(PIN_BUZZER, BUZZER_OFF);
                digitalWrite(PIN_RELAY, RELAY_OFF);

                break;

                // =================================================
                // GAS WARNING (CẢNH BÁO GAS)
                // =================================================

            case GAS_WARNING:

                updateLeds(false, true, false, false);
                digitalWrite(PIN_RELAY, RELAY_OFF);

                if (now - lastBuzzerMillis >= 500)
                {
                    lastBuzzerMillis = now;
                    buzzerState = !buzzerState;
                    digitalWrite(PIN_BUZZER, buzzerState ? BUZZER_ON : BUZZER_OFF);
                }

                break;

                // =================================================
                // FIRE WARNING (CẢNH BÁO CHÁY)
                // =================================================

            case FIRE_WARNING:

                updateLeds(false, false, true, false);
                digitalWrite(PIN_RELAY, RELAY_ON);

                if (now - lastBuzzerMillis >= 100)
                {
                    lastBuzzerMillis = now;
                    buzzerState = !buzzerState;
                    digitalWrite(PIN_BUZZER, buzzerState ? BUZZER_ON : BUZZER_OFF);
                }

                break;

                // =================================================
                // CRITICAL DANGER (NGUY HIỂM KHẨN CẤP)
                // =================================================

            case CRITICAL_DANGER:

                if (now - lastRedLedMillis >= 100)
                {
                    lastRedLedMillis = now;
                    redLedState = !redLedState;
                }

                updateLeds(false, false, false, redLedState);
                digitalWrite(PIN_RELAY, RELAY_ON);
                digitalWrite(PIN_BUZZER, BUZZER_ON);

                break;
            }

            vTaskDelay(pdMS_TO_TICKS(20));
        }
    }