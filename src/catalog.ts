// Parts this server knows how to place. `did` is Tinkercad's internal device id
// (the data-did attribute on the parts panel tiles). Pin offsets are in breadboard
// holes relative to the part origin at angle 0, as Tinkercad reports them; they are
// only used for documentation, the builder reads the real offsets at run time.

export interface PartProp {
  /** name used in a circuit spec, e.g. "ohms" */
  name: string;
  /** what the value means */
  doc: string;
}

export interface Part {
  id: string;
  label: string;
  did: number;
  aliases: string[];
  pins: Record<string, [number, number]>;
  props?: PartProp[];
  notes?: string;
}

export const PARTS: Part[] = [
  {
    id: "led", label: "LED", did: 58422, aliases: ["light emitting diode"],
    pins: { cathode: [-0.5, 0], anode: [0.5, 0] },
    props: [{ name: "color", doc: "red, green, yellow, orange, blue or white" }],
    notes: "Always put a resistor in series (220 ohm is the usual choice).",
  },
  {
    id: "resistor", label: "Resistor", did: 53184, aliases: ["res", "r"],
    pins: { "1": [0, 2], "2": [0, -2] },
    props: [{ name: "ohms", doc: "resistance in ohms, e.g. 220 or 10000" }],
    notes: "Legs are 4 holes apart. Use angle 90 to lay it along a row.",
  },
  {
    id: "pushbutton", label: "Pushbutton (4 pin)", did: 144786, aliases: ["button", "btn", "tactile switch"],
    pins: { "1": [-1, -1.5], "2": [-1, 1.5], "3": [1, -1.5], "4": [1, 1.5] },
    notes: "Straddles the centre gap. Pins 1 and 4 sit diagonally and are always on opposite sides of the switch.",
  },
  {
    id: "potentiometer", label: "Potentiometer", did: 45547, aliases: ["pot", "knob", "joystick axis"],
    pins: { term0: [-1, 0], wiper: [0, 0], term1: [1, 0] },
    props: [{ name: "position", doc: "knob position from 0 to 1 (0.5 is the middle)" }],
    notes: "Tinkercad has no KY-023 joystick; one potentiometer per axis is the usual stand-in.",
  },
  {
    id: "servo", label: "Micro servo (SG90)", did: 142073, aliases: ["micro servo", "sg90", "9g servo"],
    pins: { Ground: [-1, 0], Power: [0, 0], Signal: [1, 0] },
  },
  {
    id: "piezo", label: "Piezo buzzer", did: 114067, aliases: ["buzzer", "speaker"],
    pins: { "+": [-2.5, 0], "-": [2.5, 0] },
  },
  {
    id: "ultrasonic", label: "Ultrasonic distance sensor HC-SR04 (4 pin)", did: 219295, aliases: ["hc-sr04", "sonar"],
    pins: { pos: [-1.5, 6], trig: [-0.5, 6], echo: [0.5, 6], neg: [1.5, 6] },
    props: [{ name: "distance_cm", doc: "distance to the simulated object, roughly 2 to 335 cm" }],
  },
  {
    id: "tmp36", label: "Temperature sensor TMP36", did: 112324, aliases: ["temperature sensor", "lm35"],
    pins: { Vcc: [-1, 0], Vout: [0, 0], Gnd: [1, 0] },
    notes: "Tinkercad has no LM35. TMP36 reads (V - 0.5) * 100 degrees C.",
  },
  {
    id: "dc-motor", label: "DC motor", did: 114158, aliases: ["motor"],
    pins: { "1": [-1, 0], "2": [1, 0] },
  },
  {
    id: "dc-motor-encoder", label: "DC motor with encoder", did: 153670, aliases: ["encoder motor"],
    pins: { motor_pos: [-2.5, 0], enc_b: [-1.5, 0], enc_vcc: [-0.5, 0], enc_gnd: [0.5, 0], enc_a: [1.5, 0], motor_neg: [2.5, 0] },
    notes: "Gives about 360 pulses per revolution on enc_a in the simulator.",
  },
  {
    id: "l293d", label: "H-bridge motor driver L293D", did: 112326, aliases: ["motor driver", "h-bridge"],
    pins: {
      Vss: [-3.5, -1.5], Input4: [-2.5, -1.5], Output4: [-1.5, -1.5], GND3: [-0.5, -1.5], GND2: [0.5, -1.5], Output3: [1.5, -1.5], Input3: [2.5, -1.5], Enable2: [3.5, -1.5],
      Enable1: [-3.5, 1.5], Input1: [-2.5, 1.5], Output1: [-1.5, 1.5], GND: [-0.5, 1.5], GND1: [0.5, 1.5], Output2: [1.5, 1.5], Input2: [2.5, 1.5], Vs: [3.5, 1.5],
    },
    notes: "Straddles the centre gap. Tinkercad has no L298N; this is the usual replacement.",
  },
  {
    id: "ir-receiver", label: "IR receiver", did: 196401, aliases: ["ir sensor", "vs1838b"],
    pins: { Out: [-1, 0], Gnd: [0, 0], Vcc: [1, 0] },
  },
  {
    id: "rgb-led", label: "RGB LED", did: 58456, aliases: ["led rgb"],
    pins: { "terminal-red": [-1.5, 0], "terminal-cathode": [-0.5, 0], "terminal-blue": [0.5, 0], "terminal-green": [1.5, 0] },
  },
  {
    id: "photoresistor", label: "Photoresistor (LDR)", did: 116691, aliases: ["ldr", "light sensor"],
    pins: { "terminal-1": [-0.5, 0], "terminal-2": [0.5, 0] },
  },
  {
    id: "slide-switch", label: "Slide switch", did: 58458, aliases: ["slideswitch", "toggle"],
    pins: { "1": [-1, 0], "3": [0, 0], "2": [1, 0] },
  },
  {
    id: "npn", label: "NPN transistor", did: 58468, aliases: ["transistor", "bjt"],
    pins: { collector: [-1, 0], base: [0, 0], emitter: [1, 0] },
  },
  {
    id: "diode", label: "Diode", did: 58320, aliases: [],
    pins: { anode: [0, -2], cathode: [0, 2] },
  },
  {
    id: "capacitor", label: "Capacitor", did: 57752, aliases: ["cap"],
    pins: { "1": [-0.5, 0], "2": [0.5, 0] },
  },
  {
    id: "pir", label: "PIR motion sensor", did: 234203, aliases: ["pir sensor"],
    pins: { out: [-1, 7], vcc: [0, 7], gnd: [1, 7] },
  },
  {
    id: "shift-register", label: "8-bit shift register 74HC595", did: 116695, aliases: ["74hc595"],
    pins: {
      Vcc: [-3.5, -1.5], Q0: [-2.5, -1.5], DS: [-1.5, -1.5], OE: [-0.5, -1.5], STCP: [0.5, -1.5], SHCP: [1.5, -1.5], MR: [2.5, -1.5], Q7S: [3.5, -1.5],
      Q1: [-3.5, 1.5], Q2: [-2.5, 1.5], Q3: [-1.5, 1.5], Q4: [-0.5, 1.5], Q5: [0.5, 1.5], Q6: [1.5, 1.5], Q7: [2.5, 1.5], GND: [3.5, 1.5],
    },
  },
  {
    id: "battery-9v", label: "9 V battery", did: 116841, aliases: ["battery", "9v"],
    pins: { "+": [0, 0.5], "-": [0, -0.5] },
    notes: "Cannot sit on the breadboard. Place it with \"free\": true and wire it in.",
  },
];

export const ARDUINO_UNO_DID = 132521;
export const BREADBOARD_SMALL_DID = 111211;

/** Uno header pins as Tinkercad names them. */
export const UNO_PINS = [
  "D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13",
  "A0", "A1", "A2", "A3", "A4", "A5", "5V", "3V3", "VIN", "GND1", "GND2", "GND3", "AREF", "IOREF", "RESET", "SDA", "SCL",
];

const byKey = new Map<string, Part>();
for (const p of PARTS) {
  byKey.set(p.id, p);
  for (const a of p.aliases) byKey.set(a.toLowerCase(), p);
}

export function findPart(name: string): Part | undefined {
  return byKey.get(name.trim().toLowerCase());
}

export function searchParts(query?: string): Part[] {
  if (!query) return PARTS;
  const q = query.toLowerCase();
  return PARTS.filter((p) => p.id.includes(q) || p.label.toLowerCase().includes(q) || p.aliases.some((a) => a.includes(q)));
}
