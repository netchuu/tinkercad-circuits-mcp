# Parts

Generated from `src/catalog.ts` with `npm run parts-doc`. Pin offsets are in breadboard holes from the part's origin at angle 0 (x to the right, y down). You rarely need them: say which pin goes in which hole and the builder rotates the part until the rest fit.

## `led` - LED

Also accepted: `light emitting diode`

| pin | offset |
| --- | --- |
| `cathode` | -0.5, 0 |
| `anode` | 0.5, 0 |

Settings:

- `color`: red, green, yellow, orange, blue or white

Always put a resistor in series (220 ohm is the usual choice).

## `resistor` - Resistor

Also accepted: `res`, `r`

| pin | offset |
| --- | --- |
| `1` | 0, 2 |
| `2` | 0, -2 |

Settings:

- `ohms`: resistance in ohms, e.g. 220 or 10000

Legs are 4 holes apart. Use angle 90 to lay it along a row.

## `pushbutton` - Pushbutton (4 pin)

Also accepted: `button`, `btn`, `tactile switch`

| pin | offset |
| --- | --- |
| `1` | -1, -1.5 |
| `2` | -1, 1.5 |
| `3` | 1, -1.5 |
| `4` | 1, 1.5 |

Straddles the centre gap. Pins 1 and 4 sit diagonally and are always on opposite sides of the switch.

## `potentiometer` - Potentiometer

Also accepted: `pot`, `knob`, `joystick axis`

| pin | offset |
| --- | --- |
| `term0` | -1, 0 |
| `wiper` | 0, 0 |
| `term1` | 1, 0 |

Settings:

- `position`: knob position from 0 to 1 (0.5 is the middle)

Tinkercad has no KY-023 joystick; one potentiometer per axis is the usual stand-in.

## `servo` - Micro servo (SG90)

Also accepted: `micro servo`, `sg90`, `9g servo`

| pin | offset |
| --- | --- |
| `Ground` | -1, 0 |
| `Power` | 0, 0 |
| `Signal` | 1, 0 |

## `piezo` - Piezo buzzer

Also accepted: `buzzer`, `speaker`

| pin | offset |
| --- | --- |
| `+` | -2.5, 0 |
| `-` | 2.5, 0 |

## `ultrasonic` - Ultrasonic distance sensor HC-SR04 (4 pin)

Also accepted: `hc-sr04`, `sonar`

| pin | offset |
| --- | --- |
| `pos` | -1.5, 6 |
| `trig` | -0.5, 6 |
| `echo` | 0.5, 6 |
| `neg` | 1.5, 6 |

Settings:

- `distance_cm`: distance to the simulated object, roughly 2 to 335 cm

## `tmp36` - Temperature sensor TMP36

Also accepted: `temperature sensor`, `lm35`

| pin | offset |
| --- | --- |
| `Vcc` | -1, 0 |
| `Vout` | 0, 0 |
| `Gnd` | 1, 0 |

Tinkercad has no LM35. TMP36 reads (V - 0.5) * 100 degrees C.

## `dc-motor` - DC motor

Also accepted: `motor`

| pin | offset |
| --- | --- |
| `1` | -1, 0 |
| `2` | 1, 0 |

## `dc-motor-encoder` - DC motor with encoder

Also accepted: `encoder motor`

| pin | offset |
| --- | --- |
| `motor_pos` | -2.5, 0 |
| `enc_b` | -1.5, 0 |
| `enc_vcc` | -0.5, 0 |
| `enc_gnd` | 0.5, 0 |
| `enc_a` | 1.5, 0 |
| `motor_neg` | 2.5, 0 |

Gives about 360 pulses per revolution on enc_a in the simulator.

## `l293d` - H-bridge motor driver L293D

Also accepted: `motor driver`, `h-bridge`

| pin | offset |
| --- | --- |
| `Vss` | -3.5, -1.5 |
| `Input4` | -2.5, -1.5 |
| `Output4` | -1.5, -1.5 |
| `GND3` | -0.5, -1.5 |
| `GND2` | 0.5, -1.5 |
| `Output3` | 1.5, -1.5 |
| `Input3` | 2.5, -1.5 |
| `Enable2` | 3.5, -1.5 |
| `Enable1` | -3.5, 1.5 |
| `Input1` | -2.5, 1.5 |
| `Output1` | -1.5, 1.5 |
| `GND` | -0.5, 1.5 |
| `GND1` | 0.5, 1.5 |
| `Output2` | 1.5, 1.5 |
| `Input2` | 2.5, 1.5 |
| `Vs` | 3.5, 1.5 |

Straddles the centre gap. Tinkercad has no L298N; this is the usual replacement.

## `ir-receiver` - IR receiver

Also accepted: `ir sensor`, `vs1838b`

| pin | offset |
| --- | --- |
| `Out` | -1, 0 |
| `Gnd` | 0, 0 |
| `Vcc` | 1, 0 |

## `rgb-led` - RGB LED

Also accepted: `led rgb`

| pin | offset |
| --- | --- |
| `terminal-red` | -1.5, 0 |
| `terminal-cathode` | -0.5, 0 |
| `terminal-blue` | 0.5, 0 |
| `terminal-green` | 1.5, 0 |

## `photoresistor` - Photoresistor (LDR)

Also accepted: `ldr`, `light sensor`

| pin | offset |
| --- | --- |
| `terminal-1` | -0.5, 0 |
| `terminal-2` | 0.5, 0 |

## `slide-switch` - Slide switch

Also accepted: `slideswitch`, `toggle`

| pin | offset |
| --- | --- |
| `1` | -1, 0 |
| `2` | 1, 0 |
| `3` | 0, 0 |

## `npn` - NPN transistor

Also accepted: `transistor`, `bjt`

| pin | offset |
| --- | --- |
| `collector` | -1, 0 |
| `base` | 0, 0 |
| `emitter` | 1, 0 |

## `diode` - Diode

| pin | offset |
| --- | --- |
| `anode` | 0, -2 |
| `cathode` | 0, 2 |

## `capacitor` - Capacitor

Also accepted: `cap`

| pin | offset |
| --- | --- |
| `1` | -0.5, 0 |
| `2` | 0.5, 0 |

## `pir` - PIR motion sensor

Also accepted: `pir sensor`

| pin | offset |
| --- | --- |
| `out` | -1, 7 |
| `vcc` | 0, 7 |
| `gnd` | 1, 7 |

## `shift-register` - 8-bit shift register 74HC595

Also accepted: `74hc595`

| pin | offset |
| --- | --- |
| `Vcc` | -3.5, -1.5 |
| `Q0` | -2.5, -1.5 |
| `DS` | -1.5, -1.5 |
| `OE` | -0.5, -1.5 |
| `STCP` | 0.5, -1.5 |
| `SHCP` | 1.5, -1.5 |
| `MR` | 2.5, -1.5 |
| `Q7S` | 3.5, -1.5 |
| `Q1` | -3.5, 1.5 |
| `Q2` | -2.5, 1.5 |
| `Q3` | -1.5, 1.5 |
| `Q4` | -0.5, 1.5 |
| `Q5` | 0.5, 1.5 |
| `Q6` | 1.5, 1.5 |
| `Q7` | 2.5, 1.5 |
| `GND` | 3.5, 1.5 |

## `battery-9v` - 9 V battery

Also accepted: `battery`, `9v`

| pin | offset |
| --- | --- |
| `+` | 0, 0.5 |
| `-` | 0, -0.5 |

Cannot sit on the breadboard. Place it with "free": true and wire it in.

