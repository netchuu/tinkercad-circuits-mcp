# Circuit spec

`tinkercad_build_circuit` takes one JSON object. It replaces whatever is in the open design with:

- an Arduino Uno (unless `"arduino": false`),
- one small breadboard to the right of it,
- your parts, pushed into the holes you name,
- your wires,
- your sketch, if you give one.

```json
{
  "title": "optional new name for the design",
  "arduino": true,
  "parts": [ ... ],
  "wires": [ ... ],
  "code": "void setup() {} void loop() {}"
}
```

## The breadboard

The small breadboard has 30 columns and two halves of five rows, plus two power rails on each side.

```
        1 2 3 4 5 ...                       30
  T-   - - - - - - - - - - - - - - - - - - - -     top rails (T- outer, T+ inner)
  T+   + + + + + + + + + + + + + + + + + + + +
   j   o o o o o o o o o o o o o o o o o o o o  \
   i   o o o o o o o o o o o o o o o o o o o o   |
   h   o o o o o o o o o o o o o o o o o o o o   |  top half: j..f
   g   o o o o o o o o o o o o o o o o o o o o   |
   f   o o o o o o o o o o o o o o o o o o o o  /
       ------------- centre gap ---------------
   e   o o o o o o o o o o o o o o o o o o o o  \
   d   o o o o o o o o o o o o o o o o o o o o   |
   c   o o o o o o o o o o o o o o o o o o o o   |  bottom half: e..a
   b   o o o o o o o o o o o o o o o o o o o o   |
   a   o o o o o o o o o o o o o o o o o o o o  /
  B-   - - - - - - - - - - - - - - - - - - - -     bottom rails (B- upper, B+ lower)
  B+   + + + + + + + + + + + + + + + + + + + +
```

- A hole is a column number and a row letter: `12e`, `3j`.
- The five holes of one column in one half are connected: `12f` to `12j`, and `12a` to `12e`. The two halves are not connected across the gap.
- Each rail row is one long connection. Name a rail with `T+`, `T-`, `B+` or `B-`, optionally followed by a column (`T-12`) to pick which hole the wire goes into. Without a column the wire goes to column 1.

Nothing powers the rails by itself. Wire them to the Uno, for example `["uno.5V", "T+"]` and `["uno.GND1", "T-"]`.

## Parts

```json
{ "ref": "led1", "type": "led", "at": "9i", "pin": "anode", "angle": 180, "props": { "color": "green" } }
```

| Field | Meaning |
| --- | --- |
| `ref` | Your name for the part. Wires and the simulator refer to it. Letters, digits and `_`; `uno` is taken. |
| `type` | A part id from [parts.md](parts.md) (`led`, `resistor`, `pushbutton`, ...). Common aliases like `button` work too. |
| `at` | The hole that `pin` goes into. |
| `pin` | Which leg goes into `at`. Defaults to the part's first pin. |
| `angle` | 0, 90, 180 or 270. Leave it out and the builder tries all four and uses the first one where every leg lands in a hole. Set it when the direction matters. |
| `props` | Friendly settings, see below. |
| `raw` | Tinkercad property names, for anything `props` does not cover: `{"Target X": [10, ""]}`. |
| `free` | `{ "x": 560, "y": 60 }` instead of `at`, for parts that cannot sit on a breadboard (the 9 V battery). Units are tenths of a hole; the breadboard's centre is at x 870, y 0. |

The build fails for a part if its legs cannot all land in holes. The error says which part, and you can move it or set `angle`.

### Placing the common parts

**Resistor.** Legs are four holes apart. With `"angle": 90` it lies along a row: `"at": "5g", "pin": "1"` puts leg 1 in `5g` and leg 2 in `9g`.

**LED.** Legs are one hole apart. `"at": "9i", "pin": "anode", "angle": 180` puts the anode in `9i` and the cathode in `10i`. With `angle` 0 the cathode would go to `8i`.

**Pushbutton.** It straddles the centre gap, legs two columns apart. `"at": "19f", "pin": "1"` puts pin 1 in `19f`, pin 2 in `19e`, pin 3 in `21f` and pin 4 in `21e`. Pins 1 and 4 are diagonal and always on opposite sides of the switch, so wire one of them to ground and the other to the input pin (with `INPUT_PULLUP` in the sketch).

**Potentiometer, servo, TMP36, IR receiver.** Three pins in a row, one hole apart. Put them in one half and run wires from the same columns in the outer row (`j` or `a`) to the rails and the Uno.

**L293D, 74HC595.** Straddle the gap like the button, eight pins on each side.

**HC-SR04.** Four pins in a row (`pos`, `trig`, `echo`, `neg`); the sensor body sits off the board.

## Wires

```json
"wires": [
  ["uno.D13", "5i"],
  ["10h", "T-10"],
  { "from": "uno.5V", "to": "T+", "color": "red" }
]
```

A wire end can be:

- a hole: `5i`
- a rail: `T-`, `B+12`
- an Arduino pin: `uno.D0` ... `uno.D13`, `uno.A0` ... `uno.A5`, `uno.5V`, `uno.3V3`, `uno.VIN`, `uno.GND1`, `uno.GND2`, `uno.GND3`, `uno.AREF`, `uno.RESET`
- a part pin: `led1.anode`. The wire is attached to the hole under that pin.

Colours are picked for you: black for anything touching ground, red for 5 V, and a different colour for each signal wire. Wires from the Uno are routed at right angles over the top or bottom of the board. Set `color` to override (`black`, `red`, `orange`, `yellow`, `green`, `turquoise`, `blue`, `purple`, `pink`, `brown`).

## Settings (`props`)

| Part | Setting | Value |
| --- | --- | --- |
| `resistor` | `ohms` | 220, 10000, ... |
| `led` | `color` | red, green, yellow, orange, blue, white |
| `potentiometer` | `position` | 0 to 1, 0.5 is the middle |
| `ultrasonic` | `distance_cm` | about 2 to 335 |

`tinkercad_set_part` takes the same settings and changes them on a circuit that is already built.

## A complete example

A button on D2 that lights an LED on D13 while it is held:

```json
{
  "title": "Button lights an LED",
  "parts": [
    { "ref": "r1", "type": "resistor", "at": "5g", "pin": "1", "angle": 90, "props": { "ohms": 220 } },
    { "ref": "led1", "type": "led", "at": "9i", "pin": "anode", "angle": 180 },
    { "ref": "b1", "type": "pushbutton", "at": "19f", "pin": "1" }
  ],
  "wires": [
    ["uno.GND1", "T-1"],
    ["uno.D13", "5i"],
    ["10h", "T-10"],
    ["19j", "T-19"],
    ["21d", "uno.D2"]
  ],
  "code": "void setup() { pinMode(2, INPUT_PULLUP); pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, digitalRead(2) == LOW); }"
}
```

Reading it from the Uno outwards: D13 goes to column 5, where the resistor starts; the resistor ends in column 9, where the LED's anode is; the cathode in column 10 goes to the ground rail. The button's pin 1 column goes to ground and its pin 4 column goes to D2.

More in [examples/](../examples).
