// End-to-end check against the real Tinkercad: starts the server over stdio like an
// MCP client would, builds examples/button-led.json in a new design, reads it back and
// runs the simulation with a button press, then builds examples/servo-knob.json
// and checks the servo follows the knob.
//
//   npm run build && npm run smoke
//
// It creates one design called "tinkercad-circuits-mcp smoke test" in your account
// (or reuses it if you pass its link as the first argument).
import fs from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const reuse = process.argv[2];
const example = (name) => JSON.parse(fs.readFileSync(new URL(`../examples/${name}.json`, import.meta.url), "utf8"));
const spec = example("button-led");

const client = new Client({ name: "smoke", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"], env: { ...process.env } }));

let failures = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failures++; };
async function call(name, args = {}) {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content.find((c) => c.type === "text")?.text ?? "";
  if (res.isError) throw new Error(`${name}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

try {
  const tools = (await client.listTools()).tools.map((t) => t.name);
  check(tools.includes("tinkercad_build_circuit") && tools.includes("tinkercad_simulate"), `server lists ${tools.length} tools`);

  const status = await call("tinkercad_status");
  check(status.signedIn, "signed in to Tinkercad");
  if (!status.signedIn) throw new Error("Run `npm run login` first.");

  const opened = await call("tinkercad_open_circuit", { target: reuse ?? "new", title: "tinkercad-circuits-mcp smoke test" });
  console.log("     design:", opened.url);

  const built = await call("tinkercad_build_circuit", spec);
  check(built.errors.length === 0, `build without errors ${built.errors.length ? JSON.stringify(built.errors) : ""}`);
  check(built.codeSaved === true, "code saved");
  check(built.placed.b1?.holes["4"] === "21e", `button pin 4 sits in 21e (got ${built.placed.b1?.holes["4"]})`);

  const circuit = await call("tinkercad_get_circuit");
  const refs = circuit.parts.map((p) => p.ref).sort().join(",");
  check(refs === "b1,led1,r1", `read back parts by name (got ${refs})`);
  check(circuit.parts.find((p) => p.ref === "r1")?.props.resistance === 220, "resistor is 220 ohm");
  check(circuit.code?.includes("INPUT_PULLUP"), "read back the code");
  check(circuit.wires.some((w) => [w.from, w.to].includes("uno.D2")), "read back the wire to D2");

  const sim = await call("tinkercad_simulate", {
    samples_ms: [500, 2600, 5000],
    leds: ["led1"],
    presses: [{ ref: "b1", at_ms: 1500, hold_ms: 2000 }],
    serial: true,
    wait_for_serial: "READY",
  });
  const [before, during, after] = sim.samples.map((s) => s.leds.led1?.on);
  check(before === false && during === true && after === false, `LED off / on while pressed / off again (got ${before} ${during} ${after})`);
  check(/pressed/.test(sim.serial ?? ""), "serial shows the press");

  // second circuit in the same design: a knob turns a servo
  const servo = await call("tinkercad_build_circuit", example("servo-knob"));
  check(servo.errors.length === 0 && servo.codeSaved === true, "servo example builds");
  const middle = await call("tinkercad_simulate", { samples_ms: [4000], servos: ["s1"] });
  const a1 = middle.samples[0].servos.s1;
  check(a1 !== null && Math.abs(a1 - 90) <= 8, `knob in the middle -> servo near 90 (got ${a1} at sim ${middle.samples[0].sim_time})`);
  await call("tinkercad_set_part", { ref: "knob", props: { position: 1 } });
  const full = await call("tinkercad_simulate", { samples_ms: [4000], servos: ["s1"] });
  const a2 = full.samples[0].servos.s1;
  check(a2 !== null && a2 >= 170, `knob turned fully -> servo near 180 (got ${a2} at sim ${full.samples[0].sim_time})`);
} catch (err) {
  failures++;
  console.error("FAIL", err.message);
} finally {
  await client.close();
}
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
