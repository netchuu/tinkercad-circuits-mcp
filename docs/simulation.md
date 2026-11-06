# Simulation

`tinkercad_simulate` presses Start Simulation, follows a timeline, and stops the simulation again when it is done.

```json
{
  "samples_ms": [500, 2500, 5000],
  "leds": ["led1"],
  "servos": ["s1"],
  "serial": true,
  "wait_for_serial": "READY",
  "presses": [{ "ref": "b1", "at_ms": 1500, "hold_ms": 2000 }],
  "serial_input": [{ "at_ms": 3000, "text": "ON" }]
}
```

All times are milliseconds of real time after the simulation started (or after `wait_for_serial` appeared).

| Field | Meaning |
| --- | --- |
| `samples_ms` | When to take a reading. Up to 40. |
| `leds` | Refs of LEDs to read at each sample. |
| `servos` | Refs of servos to read at each sample. |
| `serial` | Return the last 60 lines of the Serial Monitor. |
| `wait_for_serial` | Start the timeline only once this text is printed. Handy when `setup()` prints `READY`. |
| `presses` | Hold a button down. Holds shorter than 0.6 s are stretched to 0.6 s. |
| `serial_input` | Type text into the Serial Monitor and press Send. |
| `keep_running` | Leave the simulation running afterwards. |

The answer looks like this:

```json
{
  "samples": [
    { "at_ms": 500,  "sim_time": "00:00:01", "leds": { "led1": { "on": false, "level": 0 } }, "servos": { "s1": 0 } },
    { "at_ms": 2500, "sim_time": "00:00:03", "leds": { "led1": { "on": true, "level": 0.9 } }, "servos": { "s1": 90 } }
  ],
  "serial": "READY\npressed\n",
  "warnings": []
}
```

## Timing

The simulator does not run at real-time speed. On a laptop it is usually somewhere between 60 and 100 percent, slower with servos and long sketches. `sim_time` is the simulator's own clock (whole seconds, as Tinkercad shows it) at the moment of the sample, so use it to tell where in the sketch you are.

Practical rules:

- Sample in the middle of a state, not near the edge. For an LED that is on for one second and off for one second, sample at 0.5 s and 1.5 s, not at 1.0 s.
- For short states, sample often (every 250-300 ms) and look for the pattern.
- Hold buttons for at least 0.6 s, longer if the sketch uses `delay()` in the loop.
- Send serial commands a second or two apart, and only after the sketch is ready (`wait_for_serial`).

## Reading LEDs

LED readings come from a screenshot: the server finds the LED on the canvas and measures how bright its body is. `level` goes from 0 (off) to about 1 (fully on); `on` is true above a small threshold. PWM brightness shows up as an in-between level.

## Reading servos

Servo angles come from the rotation of the servo horn in Tinkercad's drawing, converted to degrees. Expect a degree or two of error.

## Serial input

Tinkercad's Send button sends the text without a newline. If your sketch waits for `\n` before acting on a command, nothing happens. Treat a short pause as the end of a command instead:

```cpp
String line;
unsigned long lastChar = 0;

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    lastChar = millis();
    if (c == '\n' || c == '\r') { handle(line); line = ""; }
    else line += c;
  }
  if (line.length() > 0 && millis() - lastChar > 80) { handle(line); line = ""; }
}
```

## Testing different inputs

Inputs like a potentiometer position or the distance an HC-SR04 sees are part settings. Change them with `tinkercad_set_part` and run the simulation again:

```json
{ "ref": "knob", "props": { "position": 1 } }
{ "ref": "sonar", "props": { "distance_cm": 40 } }
```

`set_part` saves the change and reloads the editor, so the next simulation uses the new value.

## Checking a task

A pattern that works well: write down what the task says should happen at which moment, then turn each statement into a sample.

> Task: one press of the button makes the LED blink 10 times, 500 ms on and 500 ms off.

```json
{ "presses": [{ "ref": "b1", "at_ms": 1000, "hold_ms": 700 }],
  "samples_ms": [800, 1900, 2400, 2900, 3400, 13000],
  "leds": ["led1"] }
```

Expected: off before the press, then on and off in turn, and off at the end once the ten blinks are over.
