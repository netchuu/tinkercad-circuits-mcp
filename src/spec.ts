// The circuit spec: a small JSON format that says which parts go in which
// breadboard holes, how they are wired and what code the Arduino runs.
// See docs/circuit-spec.md for the full description.
import { z } from "zod";
import { findPart, UNO_PINS, type Part } from "./catalog.js";

export const HOLE_RE = /^([1-9]|[12][0-9]|30)([a-j])$/;
export const RAIL_RE = /^([TB][+-])([1-9]|[12][0-9]|30)?$/;

const PartSchema = z.object({
  ref: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "use letters, digits and _ (e.g. led1)"),
  type: z.string().min(1),
  at: z.string().optional(),
  pin: z.string().optional(),
  angle: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
  props: z.record(z.union([z.string(), z.number()])).optional(),
  raw: z.record(z.tuple([z.union([z.string(), z.number()]), z.string().optional()])).optional(),
  free: z.object({ x: z.number(), y: z.number() }).optional(),
});

const WireSchema = z.union([
  z.tuple([z.string(), z.string()]),
  z.object({ from: z.string(), to: z.string(), color: z.string().optional() }),
]);

export const CircuitSpecSchema = z.object({
  title: z.string().max(80).optional(),
  arduino: z.boolean().default(true),
  parts: z.array(PartSchema).max(60).default([]),
  wires: z.array(WireSchema).max(150).default([]),
  code: z.string().max(80_000).optional(),
});

export type CircuitSpec = z.infer<typeof CircuitSpecSchema>;

/** What the in-page builder needs for one part. */
export interface PlacedPart {
  ref: string;
  did: number;
  at?: string;
  pin?: string;
  angle?: number;
  free?: { x: number; y: number };
  /** [property name, value, prefix] triples passed to Tinkercad's setProperty */
  props: [string, string | number, string | undefined][];
}

export interface PlannedWire {
  from: string;
  to: string;
  color?: string;
}

export interface BuildPlan {
  arduino: boolean;
  parts: PlacedPart[];
  wires: PlannedWire[];
}

export class SpecError extends Error {}

export function ohmsToTinkercad(ohms: number): [number, string] {
  if (ohms >= 1e6) return [round(ohms / 1e6), "M"];
  if (ohms >= 1e3) return [round(ohms / 1e3), "k"];
  return [ohms, ""];
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/** Tinkercad stores the HC-SR04 target as a y offset; measured in the simulator. */
export function distanceToTargetY(cm: number): number {
  return Math.round((-98 - cm / 1.108) * 10) / 10;
}

function friendlyProps(part: Part, ref: string, props: Record<string, string | number>): PlacedPart["props"] {
  const out: PlacedPart["props"] = [];
  for (const [name, value] of Object.entries(props)) {
    if (part.id === "resistor" && name === "ohms") {
      const [v, prefix] = ohmsToTinkercad(Number(value));
      out.push(["resistance", v, prefix]);
    } else if ((part.id === "led") && name === "color") {
      out.push(["color", String(value).toLowerCase(), undefined]);
    } else if (part.id === "potentiometer" && name === "position") {
      const v = Number(value);
      if (!(v >= 0 && v <= 1)) throw new SpecError(`${ref}: position must be between 0 and 1`);
      out.push(["Position", v, undefined]);
    } else if (part.id === "ultrasonic" && name === "distance_cm") {
      out.push(["Target Y", distanceToTargetY(Number(value)), ""]);
    } else {
      throw new SpecError(`${ref}: unknown property "${name}" for ${part.id}` +
        (part.props?.length ? ` (known: ${part.props.map((p) => p.name).join(", ")})` : "") +
        `. Use "raw" to pass a Tinkercad property directly.`);
    }
  }
  return out;
}

/** Validate a spec and turn it into the plan the in-page builder runs. */
export function planCircuit(input: unknown): BuildPlan {
  const parsed = CircuitSpecSchema.safeParse(input);
  if (!parsed.success) {
    throw new SpecError(parsed.error.issues.map((i) => `${i.path.join(".") || "spec"}: ${i.message}`).join("; "));
  }
  const spec = parsed.data;
  const refs = new Map<string, Part>();
  const parts: PlacedPart[] = [];

  for (const p of spec.parts) {
    if (p.ref === "uno") throw new SpecError(`"uno" is reserved for the Arduino`);
    if (refs.has(p.ref)) throw new SpecError(`duplicate ref "${p.ref}"`);
    const part = findPart(p.type);
    if (!part) throw new SpecError(`${p.ref}: unknown part type "${p.type}". Call tinkercad_list_parts to see what exists.`);
    refs.set(p.ref, part);

    const pinNames = Object.keys(part.pins);
    if (p.free) {
      if (p.at) throw new SpecError(`${p.ref}: use either "at" or "free", not both`);
    } else {
      if (!p.at) throw new SpecError(`${p.ref}: "at" is required (a hole like "12e"), or set "free" for off-board parts`);
      if (!HOLE_RE.test(p.at) && !RAIL_RE.test(p.at)) throw new SpecError(`${p.ref}: "${p.at}" is not a breadboard hole (use 1-30 + a-j, e.g. "12e")`);
    }
    const pin = p.pin ?? pinNames[0];
    if (!pinNames.includes(pin)) throw new SpecError(`${p.ref}: ${part.id} has no pin "${pin}" (pins: ${pinNames.join(", ")})`);

    const props = friendlyProps(part, p.ref, p.props ?? {});
    for (const [name, [value, prefix]] of Object.entries(p.raw ?? {})) props.push([name, value, prefix]);
    parts.push({ ref: p.ref, did: part.did, at: p.at, pin, angle: p.angle, free: p.free, props });
  }

  const checkEnd = (end: string): void => {
    if (HOLE_RE.test(end) || RAIL_RE.test(end)) return;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\.(.+)$/.exec(end);
    if (!m) throw new SpecError(`wire end "${end}" is not a hole, rail, uno.PIN or ref.pin`);
    const [, ref, pin] = m;
    if (ref === "uno") {
      if (!spec.arduino) throw new SpecError(`wire end "${end}": this circuit has no Arduino`);
      if (!UNO_PINS.includes(pin)) throw new SpecError(`wire end "${end}": the Uno has no pin "${pin}" (try D2, A0, 5V, GND1)`);
      return;
    }
    const part = refs.get(ref);
    if (!part) throw new SpecError(`wire end "${end}": no part with ref "${ref}"`);
    if (!(pin in part.pins)) throw new SpecError(`wire end "${end}": ${part.id} has no pin "${pin}" (pins: ${Object.keys(part.pins).join(", ")})`);
  };

  const wires: PlannedWire[] = spec.wires.map((w) => {
    const wire = Array.isArray(w) ? { from: w[0], to: w[1] } : w;
    checkEnd(wire.from);
    checkEnd(wire.to);
    return wire;
  });

  return { arduino: spec.arduino, parts, wires };
}
