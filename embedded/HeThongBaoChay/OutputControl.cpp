#include "OutputControl.h"
#include "Config.h"
#include "SystemLogic.h"

// =====================================================
// BIẾN TRẠNG THÁI RELAY
// =====================================================

volatile bool relayError = false;

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
    pinMode(PIN_RELAY_FEEDBACK, INPUT_PULLUP);

    // Trạng thái ban đầu
    digitalWrite(PIN_BUZZER, BUZZER_OFF);

    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_ORANGE, LOW);
    digitalWrite(PIN_LED_RED, LOW);

    // Relay mặc định OFF
    digitalWrite(PIN_RELAY, RELAY_OFF);
}

// =====================================================
// HÀM TRỢ GIÚP ĐIỀU KHIỂN LED
// Có bộ nhớ trạng thái để tránh ghi GPIO liên tục
// =====================================================

static void updateLeds(
    bool green,
    bool yellow,
    bool orange,
    bool red)
{
    static int lastG = -1;
    static int lastY = -1;
    static int lastO = -1;
    static int lastR = -1;

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
    // Tránh warning compiler
    (void)pvParameters;

    // =================================================
    // BIẾN BUZZER
    // =================================================

    unsigned long lastBuzzerMillis = 0;

    // =================================================
    // BIẾN LED ĐỎ
    // =================================================

    unsigned long lastRedLedMillis = 0;

    // =================================================
    // TRẠNG THÁI OUTPUT
    // =================================================

    bool buzzerState = false;
    bool redLedState = false;

    // =================================================
    // STATE TRƯỚC ĐÓ
    // =================================================

    SystemState previousState = SAFE;

    // =================================================
    // BIẾN SELF-TEST RELAY
    // =================================================

    unsigned long lastPeriodicTest = 0;

    bool needBootTest = true;

    // =================================================
    // BIẾN KIỂM TRA RELAY THỤ ĐỘNG
    // =================================================

    static unsigned long lastRelayChangeTime = 0;
    static bool lastRelayCmd = false;

    // =================================================
    // VÒNG LẶP TASK
    // =================================================

    for (;;)
    {
        unsigned long now = millis();

        // =================================================
        // AUTO SELF-TEST RELAY
        //
        // - Test lúc boot
        // - Test mỗi 24 giờ nếu relay bình thường
        // - Test mỗi 5 giây nếu relay đang lỗi
        // - Chỉ thực hiện khi hệ thống SAFE
        // =================================================

        if (currentState == SAFE)
        {
            unsigned long testInterval;

            if (relayError)
            {
                // Nếu relay lỗi -> thử phục hồi mỗi 5 giây
                testInterval = 5000UL;
            }
            else
            {
                // Relay bình thường -> test mỗi 24 giờ
                testInterval = 86400000UL;
            }

            if (needBootTest ||
                (now - lastPeriodicTest >= testInterval))
            {
                // -----------------------------------------
                // THÔNG BÁO
                // -----------------------------------------

                if (relayError)
                {
                    Serial.println(
                        "[RECOVERY] Dang kiem tra xem Relay da duoc sua chua chua..."
                    );
                }
                else
                {
                    Serial.println(
                        "[TEST] Bat dau tu chan doan dinh ky Relay..."
                    );
                }

                // -----------------------------------------
                // BƯỚC 1: ĐÓNG RELAY
                // -----------------------------------------

                digitalWrite(PIN_RELAY, RELAY_ON);

                // Chờ relay đóng
                vTaskDelay(pdMS_TO_TICKS(50));

                bool testFailed = false;

                // Feedback HIGH = relay chưa đóng
                if (digitalRead(PIN_RELAY_FEEDBACK) == HIGH)
                {
                    Serial.println(
                        "[TEST LOI] Relay khong the dong "
                        "(cuon hut hong / dut cap)!"
                    );

                    testFailed = true;
                }

                // -----------------------------------------
                // BƯỚC 2: MỞ RELAY
                // -----------------------------------------

                digitalWrite(PIN_RELAY, RELAY_OFF);

                // Chờ relay mở
                vTaskDelay(pdMS_TO_TICKS(50));

                // Feedback LOW = relay vẫn còn đóng
                if (digitalRead(PIN_RELAY_FEEDBACK) == LOW)
                {
                    Serial.println(
                        "[TEST LOI] Relay bi ket / dinh tiep diem!"
                    );

                    testFailed = true;
                }

                // -----------------------------------------
                // KẾT QUẢ SELF-TEST
                // -----------------------------------------

                if (!testFailed)
                {
                    relayError = false;

                    Serial.println(
                        "[TEST OK] Relay hoat dong binh thuong!"
                    );
                }
                else
                {
                    relayError = true;

                    Serial.println(
                        "[TEST FAIL] Phat hien loi Relay!"
                    );
                }

                // -----------------------------------------
                // CẬP NHẬT THỜI GIAN
                // -----------------------------------------

                lastPeriodicTest = millis();
                needBootTest = false;

                now = millis();
            }
        }

        // =================================================
        // PHÁT HIỆN STATE THAY ĐỔI
        // =================================================

        if (currentState != previousState)
        {
            // Reset trạng thái buzzer
            buzzerState = false;

            // Reset LED đỏ
            redLedState = false;

            // Reset timer
            lastBuzzerMillis = now;
            lastRedLedMillis = now;

            // Lưu state mới
            previousState = currentState;
        }

        // =================================================
        // ĐIỀU KHIỂN OUTPUT THEO SYSTEM STATE
        // =================================================

        switch (currentState)
        {
            // =================================================
            // SAFE
            // =================================================

            case SAFE:

                // LED xanh ON
                updateLeds(
                    true,
                    false,
                    false,
                    false
                );

                // Buzzer OFF
                digitalWrite(
                    PIN_BUZZER,
                    BUZZER_OFF
                );

                // Relay OFF
                digitalWrite(
                    PIN_RELAY,
                    RELAY_OFF
                );

                break;

            // =================================================
            // GAS WARNING
            // =================================================

            case GAS_WARNING:

                // LED vàng ON
                updateLeds(
                    false,
                    true,
                    false,
                    false
                );

                // Relay OFF
                digitalWrite(
                    PIN_RELAY,
                    RELAY_OFF
                );

                // Buzzer nhấp nháy 500 ms
                if (now - lastBuzzerMillis >= 500)
                {
                    lastBuzzerMillis = now;

                    buzzerState = !buzzerState;

                    digitalWrite(
                        PIN_BUZZER,
                        buzzerState
                            ? BUZZER_ON
                            : BUZZER_OFF
                    );
                }

                break;

            // =================================================
            // FIRE WARNING
            // =================================================

            case FIRE_WARNING:

                // LED cam ON
                updateLeds(
                    false,
                    false,
                    true,
                    false
                );

                // Relay ON
                digitalWrite(
                    PIN_RELAY,
                    RELAY_ON
                );

                // Buzzer nhanh hơn - 100 ms
                if (now - lastBuzzerMillis >= 100)
                {
                    lastBuzzerMillis = now;

                    buzzerState = !buzzerState;

                    digitalWrite(
                        PIN_BUZZER,
                        buzzerState
                            ? BUZZER_ON
                            : BUZZER_OFF
                    );
                }

                break;

            // =================================================
            // CRITICAL DANGER
            // =================================================

            case CRITICAL_DANGER:

                // LED đỏ nhấp nháy 100 ms
                if (now - lastRedLedMillis >= 100)
                {
                    lastRedLedMillis = now;

                    redLedState = !redLedState;
                }

                updateLeds(
                    false,
                    false,
                    false,
                    redLedState
                );

                // Relay ON
                digitalWrite(
                    PIN_RELAY,
                    RELAY_ON
                );

                // Buzzer ON liên tục
                digitalWrite(
                    PIN_BUZZER,
                    BUZZER_ON
                );

                break;
        }

        // =================================================
        // KIỂM TRA RELAY FEEDBACK THỤ ĐỘNG
        // =================================================

        // Relay phải ON khi:
        // FIRE_WARNING hoặc CRITICAL_DANGER

        bool currentRelayCmd =
            (
                currentState == FIRE_WARNING ||
                currentState == CRITICAL_DANGER
            );

        // -----------------------------------------
        // Phát hiện Relay command thay đổi
        // -----------------------------------------

        if (currentRelayCmd != lastRelayCmd)
        {
            lastRelayCmd = currentRelayCmd;

            lastRelayChangeTime = now;
        }

        // -----------------------------------------
        // Chờ relay ổn định > 50 ms
        // -----------------------------------------

        if (now - lastRelayChangeTime > 50)
        {
            bool feedbackState =
                digitalRead(PIN_RELAY_FEEDBACK);

            // -----------------------------------------
            // TRƯỜNG HỢP 1:
            // Command ON nhưng Feedback HIGH
            // => Relay không đóng
            // -----------------------------------------

            if (currentRelayCmd == true &&
                feedbackState == HIGH)
            {
                relayError = true;
            }

            // -----------------------------------------
            // TRƯỜNG HỢP 2:
            // Command OFF nhưng Feedback LOW
            // => Relay bị kẹt / dính
            // -----------------------------------------

            else if (currentRelayCmd == false &&
                     feedbackState == LOW)
            {
                relayError = true;
            }

            // -----------------------------------------
            // TRƯỜNG HỢP 3:
            // Command ON + Feedback LOW
            // => Relay hoạt động bình thường
            // -----------------------------------------

            else
            {
                if (currentRelayCmd == true &&
                    feedbackState == LOW)
                {
                    relayError = false;
                }

                // Khi OFF + HIGH:
                // Không tự động xóa relayError.
                //
                // Lý do:
                // Relay bị đứt dây có thể vẫn trả về HIGH.
                // Việc xác nhận relay phục hồi sẽ do
                // Auto Recovery / Self-Test xử lý.
            }
        }

        // =================================================
        // NHƯỜNG CPU CHO TASK KHÁC
        // =================================================

        vTaskDelay(pdMS_TO_TICKS(20));
    }
}

