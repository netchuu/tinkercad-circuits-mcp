---
name: tinkercad-circuits
description: Build, simulate and check Arduino Uno breadboard circuits in Tinkercad Circuits with the tinkercad-circuits MCP server. Use when someone asks to make a Tinkercad circuit, turn a lab task or assignment into a working Tinkercad design, or test what an existing design does.
---

# Tinkercad Circuits

The `tinkercad-circuits` MCP server builds circuits straight into the user's Tinkercad account and runs the simulator. These notes are what makes the difference between a circuit that looks right and one that does what the task says.

## Before you start

1. Call `tinkercad_status`. If it is not signed in, ask the user to run `npm run login` in the server's folder and sign in themselves. Never type a password for them.
2. Read the task twice and write down, for yourself, what should happen and when. Those statements become your simulation checks later.

## Building

Open or create a design with `tinkercad_open_circuit` (`"new"` plus a title the user will recognise, e.g. "07 - Two LEDs alternate"). Then send the whole circuit in one `tinkercad_build_circuit` call. The format is in the repo's `docs/circuit-spec.md`; `tinkercad_list_parts` gives pin names.

Layouts that work on the small breadboard (30 columns, rows j-f on top, e-a below the gap):

- **Rails first.** `["uno.GND1", "T-"]`, and `["uno.5V", "T+"]` if anything needs 5 V. Use `B-`/`B+` with `uno.GND2` for parts in the bottom half.
- **LED with resistor, 6 columns per LED, top half.** For a block starting at column c:
  resistor `at: "<c>g", pin: "1", angle: 90` (spans c..c+4), LED `at: "<c+4>i", pin: "anode", angle: 180` (cathode at c+5), wires `["uno.Dx", "<c>i"]` and `["<c+5>h", "T-<c+5>"]`. Four LEDs fit at c = 1, 7, 13, 19.
- **Pushbutton across the gap.** Centre column c: `at: "<c-1>f", pin: "1"`, then `["<c-1>j", "T-<c-1>"]` to ground and `["<c+1>d", "uno.Dx"]` to the input, with `INPUT_PULLUP` in the sketch. Pins 1 and 4 are diagonal, so this always goes through the switch.
- **Three-pin parts (potentiometer, servo, TMP36, IR receiver), bottom half.** Put the first pin at `"<c-1>c"` with `angle: 0`, and wire from row `a` of the same three columns to the B rails and the Uno.
- **L293D or 74HC595** straddle the gap like a button; plan them first, they take 8 columns.
- Two legs in the same column half are connected. Check that no two parts share a column unless you mean them to.

Use a 220 ohm resistor with every LED. Name the refs so a reader understands them (`red`, `btnStart`, `servoBase`).

When Tinkercad lacks the part a task names, use the stand-in and say so in a comment at the top of the sketch:

| Task says | Use |
| --- | --- |
| KY-023 joystick | one potentiometer per axis (wiper to A0/A1), a pushbutton for SW |
| LM35 | TMP36, temperature = (V - 0.5) * 100 |
| HC-05 / HC-06 Bluetooth | commands typed in the Serial Monitor |
| L298N | L293D |
| IR line sensor | a pushbutton (pressed = sees the line) |
| Wheel encoder | `dc-motor-encoder` (about 360 pulses per turn) |

If a task insists on a part with no stand-in, tell the user instead of quietly changing the task.

After building, check the response: `errors` must be empty and `codeSaved` true. If a part could not be placed, move it rather than dropping it.

## Checking

Run `tinkercad_simulate` and compare the readings with what the task says. Turn each sentence of the task into a sample:

- "LED on for 1 s, off for 1 s": samples in the middle of each state (0.5 s, 1.5 s, 2.5 s).
- "after one press the LEDs show 1010": sample before the press and a second after it.
- "servo goes to 90 and stays": read the servo a few seconds in.
- Serial tasks: `serial: true`, `wait_for_serial` with whatever `setup()` prints, commands a couple of seconds apart.

Things that will trip you up:

- The simulator runs slower than real time. Read `sim_time` in each sample, sample in the middle of states, and hold buttons for 0.7 s or more.
- The Serial Monitor's Send button sends no newline. Sketches that parse commands must treat a short pause as the end of a line (example in `docs/simulation.md`).
- To test other inputs (knob turned, object closer), use `tinkercad_set_part` with `position` or `distance_cm`, then simulate again.
- `Servo` takes over timer 1, so `analogWrite` on pins 9 and 10 stops working in sketches that use servos.
- A function that takes an `enum` parameter can fail to compile in Tinkercad (the Arduino prototype generator puts the prototype before the enum). Use plain `int` constants for state machines.
- Only one process can use the browser profile. Do not run two builds at once.

When a check fails, fix the circuit or the sketch and run it again. Report to the user what you verified and what you could not (sound from a buzzer, for example, cannot be checked).
