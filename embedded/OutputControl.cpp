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

    if (g != lastG) { digitalWrite(PIN_LED_GREEN, g); lastG = g; }
    if (y != lastY) { digitalWrite(PIN_LED_YELLOW, y); lastY = y; }
    if (o != lastO) { digitalWrite(PIN_LED_ORANGE, o); lastO = o; }
    if (r != lastR) { digitalWrite(PIN_LED_RED, r); lastR = r; }
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