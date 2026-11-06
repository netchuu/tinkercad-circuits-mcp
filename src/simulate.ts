// Runs the Tinkercad simulator and reports what happened: LED brightness, servo
// angles and Serial Monitor text, sampled at the times you ask for. It can also
// press buttons and type into the Serial Monitor along the way.
import type { Page } from "playwright-core";
import { editorPage, stopSimulationIfRunning, zoomToFit } from "./editor.js";
import { pageLocate, pageSamplePixels, pageSerialText, pageServoRotation, pageSimClock } from "./page.js";

export interface SimulateOptions {
  /** wall-clock milliseconds after the simulation starts at which to sample */
  samples: number[];
  leds?: string[];
  servos?: string[];
  serial?: boolean;
  /** wait until this text appears in the Serial Monitor before the timeline starts */
  waitForSerial?: string;
  presses?: { ref: string; at_ms: number; hold_ms?: number }[];
  serialInput?: { at_ms: number; text: string }[];
  keepRunning?: boolean;
}

export interface Sample {
  at_ms: number;
  sim_time: string | null;
  leds: Record<string, { on: boolean; level: number }>;
  servos: Record<string, number | null>;
}

// An unlit LED's body reads about 128 on its brightest colour channel; a lit one 160-190.
const LED_OFF = 128;
const LED_FULL = 180;
// The horn rotation Tinkercad draws is about 4 + 0.928 x angle.
const servoAngle = (r: number | null) => (r === null ? null : Math.max(0, Math.min(180, Math.round((r - 4) / 0.928))));

async function openCodePanel(page: Page): Promise<void> {
  if (await page.locator(".js-code_panel__serial__text").first().isVisible().catch(() => false)) return;
  await page.getByText("Code", { exact: true }).first().click();
  await page.waitForTimeout(1200);
}

export async function simulate(opts: SimulateOptions): Promise<{ samples: Sample[]; serial: string | null; warnings: string[] }> {
  const page = await editorPage();
  const warnings: string[] = [];
  await stopSimulationIfRunning(page);
  const wantSerial = !!(opts.serial || opts.waitForSerial || opts.serialInput?.length);
  if (wantSerial) await openCodePanel(page);
  await zoomToFit(page);

  await page.getByText("Start Simulation").first().click();
  await page.getByText("Stop Simulation").first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(500);

  if (opts.waitForSerial) {
    const until = Date.now() + 40_000;
    while (!(await page.evaluate(pageSerialText)).includes(opts.waitForSerial)) {
      if (Date.now() > until) { warnings.push(`"${opts.waitForSerial}" never appeared in the Serial Monitor`); break; }
      await page.waitForTimeout(400);
    }
  }

  const refs = [...new Set([...(opts.leds ?? []), ...(opts.servos ?? []), ...(opts.presses ?? []).map((p) => p.ref)])];
  const boxes = await page.evaluate(pageLocate, refs);
  for (const r of refs) if (!boxes[r]) warnings.push(`part "${r}" was not found on the canvas`);

  type Event =
    | { t: number; kind: "sample" }
    | { t: number; kind: "down" | "up"; ref: string }
    | { t: number; kind: "type"; text: string };
  const events: Event[] = [
    ...opts.samples.map((t): Event => ({ t, kind: "sample" })),
    ...(opts.presses ?? []).flatMap((p): Event[] => [
      { t: p.at_ms, kind: "down", ref: p.ref },
      // the simulator runs slower than real time; shorter presses can be missed
      { t: p.at_ms + Math.max(600, p.hold_ms ?? 700), kind: "up", ref: p.ref },
    ]),
    ...(opts.serialInput ?? []).map((s): Event => ({ t: s.at_ms, kind: "type", text: s.text })),
  ].sort((a, b) => a.t - b.t);

  const samples: Sample[] = [];
  const t0 = Date.now();
  for (const ev of events) {
    const wait = t0 + ev.t - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
    if (ev.kind === "down") {
      const b = boxes[ev.ref];
      if (b) { await page.mouse.move(b.x, b.y); await page.mouse.down(); }
    } else if (ev.kind === "up") {
      await page.mouse.up();
    } else if (ev.kind === "type") {
      await page.locator(".js-code_panel__serial__input").fill(ev.text);
      await page.locator(".code_panel__serial__buttons a", { hasText: "Send" }).first().click();
    } else {
      samples.push(await takeSample(page, ev.t, opts, boxes));
    }
  }
  await page.mouse.up().catch(() => {});

  let serial: string | null = null;
  if (wantSerial) {
    await page.waitForTimeout(600);
    serial = (await page.evaluate(pageSerialText)).split("\n").slice(-60).join("\n");
  }
  if (!opts.keepRunning) await stopSimulationIfRunning(page);
  return { samples, serial, warnings };
}

async function takeSample(page: Page, at: number, opts: SimulateOptions, boxes: Awaited<ReturnType<typeof pageLocate>>): Promise<Sample> {
  const sample: Sample = { at_ms: at, sim_time: await page.evaluate(pageSimClock), leds: {}, servos: {} };
  const leds = (opts.leds ?? []).filter((r) => boxes[r]);
  if (leds.length) {
    const png = (await page.screenshot()).toString("base64");
    const values = await page.evaluate(pageSamplePixels, { png, points: leds.map((r) => ({ x: boxes[r]!.x, y: boxes[r]!.y })) });
    leds.forEach((r, i) => {
      const level = Math.max(0, Math.min(1, (values[i] - LED_OFF) / (LED_FULL - LED_OFF)));
      sample.leds[r] = { on: values[i] > LED_OFF + 12, level: Math.round(level * 100) / 100 };
    });
  }
  const servos = (opts.servos ?? []).filter((r) => boxes[r]);
  if (servos.length) {
    const rot = await page.evaluate(pageServoRotation, servos.map((r) => boxes[r]!.id));
    servos.forEach((r, i) => { sample.servos[r] = servoAngle(rot[i]); });
  }
  return sample;
}
