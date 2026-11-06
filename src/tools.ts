import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { findPart, searchParts, PARTS } from "./catalog.js";
import { CircuitSpecSchema, friendlyProps, planCircuit, SpecError } from "./spec.js";
import { buildCircuit, editorPage, openCircuit, readCircuit, reloadEditor, renameCircuit, screenshot, setCode, signInStatus, stopSimulationIfRunning, waitForSave } from "./editor.js";
import { pageSetProps } from "./page.js";
import { getPage } from "./browser.js";
import { simulate } from "./simulate.js";

function json(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function fail(err: unknown): CallToolResult {
  const message = err instanceof Error ? err.message.split("\n")[0] : String(err);
  return { isError: true, content: [{ type: "text", text: message }] };
}

async function run(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try { return await fn(); } catch (err) { return fail(err); }
}

export function registerTools(server: McpServer): void {
  server.registerTool("tinkercad_status", {
    title: "Check Tinkercad sign-in",
    description: "Opens the Tinkercad dashboard in the server's Chrome profile and reports whether you are signed in. If not, the user has to run `npm run login` once.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, () => run(async () => json(await signInStatus())));

  server.registerTool("tinkercad_list_parts", {
    title: "List parts",
    description: "Lists the parts that can go in a circuit spec, with their pin names, pin offsets (in breadboard holes, at angle 0) and settable properties. Filter with a word like 'led', 'motor' or 'sensor'.",
    inputSchema: { query: z.string().max(60).optional() },
    annotations: { readOnlyHint: true },
  }, ({ query }) => run(async () => json(searchParts(query).map(({ id, label, aliases, pins, props, notes }) => ({ id, label, aliases, pins, props, notes })))));

  server.registerTool("tinkercad_open_circuit", {
    title: "Open or create a circuit",
    description: "Opens an existing Tinkercad Circuits design (link or id) in the editor, or creates a new one with target \"new\". Optionally renames it.",
    inputSchema: {
      target: z.string().min(1).describe('"new", a design link like https://www.tinkercad.com/things/abc123, or just the id'),
      title: z.string().max(80).optional(),
    },
  }, ({ target, title }) => run(async () => json(await openCircuit(target, title))));

  server.registerTool("tinkercad_build_circuit", {
    title: "Build a circuit",
    description: [
      "Replaces everything in the open circuit with the one described here: an Arduino Uno, one small breadboard,",
      "the listed parts placed in breadboard holes, the wires and (optionally) the Arduino code. If no circuit is open,",
      "a new one is created. Holes are named like '12e' (columns 1-30, rows a-j; a-e and f-j are the two halves).",
      "Rails are T+, T-, B+, B- with an optional column (T-12). Wire ends are holes, rails, uno.PIN (uno.D13, uno.A0, uno.5V, uno.GND1)",
      "or ref.pin (led1.anode). `pin` says which leg of the part goes into `at`; the part is rotated until all legs land in holes.",
      "See docs/circuit-spec.md for examples.",
    ].join(" "),
    inputSchema: CircuitSpecSchema.shape,
  }, (spec) => run(async () => {
    let plan;
    try { plan = planCircuit(spec); } catch (err) { if (err instanceof SpecError) return fail(err); throw err; }
    const page = await getPage();
    if (!page.url().includes("/editel")) await openCircuit("new");
    if (spec.title) await renameCircuit(await editorPage(), spec.title);
    const result = await buildCircuit(plan, spec.code);
    const circuit = await readCircuit();
    return json({ url: circuit.url, title: circuit.title, placed: result.placed, codeSaved: result.codeSaved, errors: result.errors });
  }));

  server.registerTool("tinkercad_get_circuit", {
    title: "Read the open circuit",
    description: "Returns the open circuit as Tinkercad has it saved: each part with the hole under every pin, its properties, every wire and the Arduino code.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, () => run(async () => json(await readCircuit())));

  server.registerTool("tinkercad_set_code", {
    title: "Set the Arduino code",
    description: "Replaces the Arduino sketch of the open circuit (text code, not blocks).",
    inputSchema: { code: z.string().min(1).max(80_000) },
  }, ({ code }) => run(async () => json({ saved: await setCode(code) })));

  server.registerTool("tinkercad_set_part", {
    title: "Change a part setting",
    description: "Changes a setting on a part that is already in the circuit, e.g. a potentiometer position (0-1) or the distance an ultrasonic sensor sees. Use it between simulation runs to test different inputs.",
    inputSchema: {
      ref: z.string().min(1),
      props: z.record(z.union([z.string(), z.number()])).describe('friendly settings, e.g. {"position": 0.8} or {"distance_cm": 40}'),
    },
  }, ({ ref, props }) => run(async () => {
    const circuit = await readCircuit();
    const part = circuit.parts.find((p) => p.ref === ref);
    if (!part) return fail(`No part named "${ref}" in this circuit.`);
    const def = findPart(part.type) ?? PARTS.find((p) => p.did === part.did);
    if (!def) return fail(`Part "${ref}" is a type this server does not know.`);
    const triples = friendlyProps(def, ref, props);
    const page = await editorPage();
    await stopSimulationIfRunning(page);
    const ok = await page.evaluate(pageSetProps, { ref, props: triples });
    await waitForSave(page);
    await reloadEditor(page);
    return json({ updated: ok });
  }));

  server.registerTool("tinkercad_simulate", {
    title: "Run the simulation",
    description: [
      "Starts the simulator, optionally presses buttons and types into the Serial Monitor, and samples LED brightness,",
      "servo angles and simulator time at the given moments (milliseconds after start). Returns the samples and the end of",
      "the Serial Monitor text. The simulator usually runs a bit slower than real time, so leave some margin and check sim_time.",
    ].join(" "),
    inputSchema: {
      samples_ms: z.array(z.number().int().min(0).max(60_000)).min(1).max(40),
      leds: z.array(z.string()).optional().describe("refs of LEDs to read"),
      servos: z.array(z.string()).optional().describe("refs of servos to read"),
      serial: z.boolean().optional().describe("return the Serial Monitor text"),
      wait_for_serial: z.string().optional().describe("start the timeline only after this text is printed (e.g. READY)"),
      presses: z.array(z.object({ ref: z.string(), at_ms: z.number().int().min(0), hold_ms: z.number().int().min(0).max(10_000).optional() })).optional(),
      serial_input: z.array(z.object({ at_ms: z.number().int().min(0), text: z.string().max(200) })).optional(),
      keep_running: z.boolean().optional(),
    },
  }, (a) => run(async () => json(await simulate({
    samples: a.samples_ms, leds: a.leds, servos: a.servos, serial: a.serial, waitForSerial: a.wait_for_serial,
    presses: a.presses, serialInput: a.serial_input, keepRunning: a.keep_running,
  }))));

  server.registerTool("tinkercad_screenshot", {
    title: "Screenshot",
    description: "Returns a PNG of the Tinkercad window as it is right now.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, () => run(async () => {
    const shot = await screenshot();
    return { content: [{ type: "image", data: shot.png.toString("base64"), mimeType: "image/png" }, { type: "text", text: shot.path }] };
  }));
}
