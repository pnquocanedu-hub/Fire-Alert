#ifndef OUTPUT_CONTROL_H
#define OUTPUT_CONTROL_H

#include <Arduino.h>

extern volatile bool relayError;

void initOutputs();

void Task_OutputControl(void *pvParameters);

#endif
