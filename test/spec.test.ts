import { test } from "node:test";
import assert from "node:assert/strict";
import { planCircuit, SpecError, ohmsToTinkercad, distanceToTargetY } from "../src/spec.js";
import { PARTS, findPart, searchParts } from "../src/catalog.js";

const blink = {
  parts: [
    { ref: "r1", type: "resistor", at: "5g", pin: "1", angle: 90, props: { ohms: 220 } },
    { ref: "led1", type: "led", at: "9i", pin: "anode", angle: 180, props: { color: "Red" } },
  ],
  wires: [["uno.D13", "5i"], ["10h", "T-10"], ["uno.GND1", "T-1"]],
  code: "void setup(){} void loop(){}",
};

test("a simple LED circuit plans cleanly", () => {
  const plan = planCircuit(blink);
  assert.equal(plan.arduino, true);
  assert.equal(plan.parts.length, 2);
  assert.deepEqual(plan.parts[0].props, [["resistance", 220, ""]]);
  assert.deepEqual(plan.parts[1].props, [["color", "red", undefined]]);
  assert.deepEqual(plan.wires[0], { from: "uno.D13", to: "5i" });
});

test("pin defaults to the part's first pin", () => {
  const plan = planCircuit({ parts: [{ ref: "b", type: "button", at: "9f" }] });
  assert.equal(plan.parts[0].pin, "1");
});

test("unknown part types are rejected with a hint", () => {
  assert.throws(() => planCircuit({ parts: [{ ref: "x", type: "flux capacitor", at: "1a" }] }), /tinkercad_list_parts/);
});

test("bad holes are rejected", () => {
  assert.throws(() => planCircuit({ parts: [{ ref: "l", type: "led", at: "31a" }] }), SpecError);
  assert.throws(() => planCircuit({ parts: [{ ref: "l", type: "led", at: "5k" }] }), SpecError);
});

test("wire ends must point at something real", () => {
  assert.throws(() => planCircuit({ wires: [["uno.D14", "1a"]] }), /no pin "D14"/);
  assert.throws(() => planCircuit({ wires: [["led9.anode", "1a"]] }), /no part with ref/);
  assert.throws(() => planCircuit({ parts: [{ ref: "l", type: "led", at: "5a" }], wires: [["l.plus", "1a"]] }), /no pin "plus"/);
  assert.throws(() => planCircuit({ arduino: false, wires: [["uno.5V", "1a"]] }), /no Arduino/);
});

test("rails accept an optional column", () => {
  assert.doesNotThrow(() => planCircuit({ wires: [["T+", "B+30"], ["T-12", "B-"]] }));
});

test("duplicate refs and the reserved uno ref are rejected", () => {
  assert.throws(() => planCircuit({ parts: [{ ref: "a", type: "led", at: "1a" }, { ref: "a", type: "led", at: "3a" }] }), /duplicate/);
  assert.throws(() => planCircuit({ parts: [{ ref: "uno", type: "led", at: "1a" }] }), /reserved/);
});

test("free parts skip the hole check", () => {
  const plan = planCircuit({ arduino: false, parts: [{ ref: "bat", type: "battery-9v", free: { x: 560, y: 60 } }] });
  assert.deepEqual(plan.parts[0].free, { x: 560, y: 60 });
});

test("unknown friendly props point at raw", () => {
  assert.throws(() => planCircuit({ parts: [{ ref: "s", type: "servo", at: "5c", props: { speed: 2 } }] }), /raw/);
});

test("resistor values get Tinkercad's prefix", () => {
  assert.deepEqual(ohmsToTinkercad(220), [220, ""]);
  assert.deepEqual(ohmsToTinkercad(4700), [4.7, "k"]);
  assert.deepEqual(ohmsToTinkercad(1_000_000), [1, "M"]);
});

test("ultrasonic distance maps to the measured target offset", () => {
  // values measured in the simulator: -200 -> 113 cm, -134 -> 40 cm, -369 -> 300 cm
  assert.ok(Math.abs(distanceToTargetY(113) - -200) < 1);
  assert.ok(Math.abs(distanceToTargetY(40) - -134) < 1);
  assert.ok(Math.abs(distanceToTargetY(300) - -369) < 1);
});

test("catalog ids and aliases resolve, dids are unique", () => {
  assert.equal(findPart("Button")?.id, "pushbutton");
  assert.equal(findPart("hc-sr04")?.id, "ultrasonic");
  assert.equal(new Set(PARTS.map((p) => p.did)).size, PARTS.length);
  assert.ok(searchParts("motor").length >= 3);
});
