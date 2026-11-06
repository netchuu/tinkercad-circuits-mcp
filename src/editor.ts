// Editor-level actions: open/create a circuit, rename it, build it from a plan,
// read it back, write code, take a screenshot.
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import type { Page } from "playwright-core";
import { getPage, checkSignedIn, TINKERCAD } from "./browser.js";
import { pageBuild, pageClear, pageEditorReady, pagePendingSaves, pageRead, pageSetCode, type BuildResult, type ReadResult } from "./page.js";
import type { BuildPlan } from "./spec.js";
import { PARTS } from "./catalog.js";

export class EditorError extends Error {}

export function designUrl(target: string): string {
  if (/^https?:\/\//.test(target)) {
    const u = new URL(target);
    if (u.hostname !== "www.tinkercad.com" && u.hostname !== "tinkercad.com") {
      throw new EditorError(`Only tinkercad.com links can be opened, got ${u.hostname}`);
    }
    const m = /\/things\/([A-Za-z0-9]+)/.exec(u.pathname);
    if (!m) throw new EditorError(`Not a Tinkercad design link: ${target}`);
    return `${TINKERCAD}/things/${m[1]}/editel`;
  }
  if (/^[A-Za-z0-9]{6,20}$/.test(target)) return `${TINKERCAD}/things/${target}/editel`;
  throw new EditorError(`"${target}" is not a design link or id`);
}

async function waitForEditor(page: Page): Promise<void> {
  await page.waitForFunction(pageEditorReady, null, { timeout: 90_000 }).catch(() => {
    if (/login|signin|auth/i.test(page.url())) {
      throw new EditorError("Tinkercad asked for a sign-in. Run `npm run login` and try again.");
    }
    throw new EditorError(`The circuit editor did not load (page: ${page.url()}).`);
  });
  await page.waitForTimeout(2500);
}

/** Waits until Tinkercad's server has acknowledged every edit. */
export async function waitForSave(page: Page, timeoutMs = 30_000): Promise<boolean> {
  const until = Date.now() + timeoutMs;
  let quiet = 0;
  while (Date.now() < until) {
    quiet = (await page.evaluate(pagePendingSaves)) === 0 ? quiet + 1 : 0;
    if (quiet >= 3) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

export async function reloadEditor(page: Page): Promise<void> {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForEditor(page);
}

export async function editorPage(): Promise<Page> {
  const page = await getPage();
  if (!page.url().includes("/editel")) throw new EditorError("No circuit is open. Call tinkercad_open_circuit first.");
  return page;
}

async function createCircuit(page: Page): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto(`${TINKERCAD}/circuits`, { waitUntil: "domcontentloaded" });
      const create = page.locator('button:has-text("Create"), a:has-text("Create")').filter({ hasText: /^\s*\+?\s*Create\s*$/ }).first();
      await create.waitFor({ state: "visible", timeout: 30_000 });
      await create.click();
      await page.waitForTimeout(500);
      await page.locator('a, button, li, [role="menuitem"]').filter({ hasText: /^\s*Circuits\s*$/ }).first().click();
      await page.waitForURL(/\/things\/.+\/editel/, { timeout: 60_000 });
      return;
    } catch (err) {
      if (/login|signin|auth/i.test(page.url())) throw new EditorError("Not signed in to Tinkercad. Run `npm run login` first.");
      if (attempt >= 3) throw new EditorError(`Could not create a new circuit: ${(err as Error).message.split("\n")[0]}`);
    }
  }
}

export async function renameCircuit(page: Page, title: string): Promise<void> {
  const box = page.locator(".js-topnav-title, .topnav__title, [class*='topnav'] [class*='title']").first();
  if (await box.isVisible().catch(() => false)) await box.click();
  else await page.mouse.click(150, 24); // the title sits at the top left of the editor
  await page.waitForTimeout(300);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type(title);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
}

export async function openCircuit(target: string, title?: string): Promise<{ url: string; title: string }> {
  const page = await getPage();
  if (target === "new") await createCircuit(page);
  else await page.goto(designUrl(target), { waitUntil: "domcontentloaded" });
  await waitForEditor(page);
  if (title) await renameCircuit(page, title);
  return { url: page.url().split("?")[0], title: await circuitTitle(page) };
}

export async function circuitTitle(page: Page): Promise<string> {
  return (await page.title()).replace(/^Circuit design /, "").replace(/ - Tinkercad$/, "");
}

export async function buildCircuit(plan: BuildPlan, code?: string): Promise<BuildResult & { codeSaved: boolean | null }> {
  const page = await editorPage();
  await stopSimulationIfRunning(page);
  await page.evaluate(pageClear);
  await page.waitForTimeout(800);
  const result = await page.evaluate(pageBuild, plan);
  let codeSaved: boolean | null = null;
  if (code !== undefined && plan.arduino) {
    // Writing the code in the same recorded edit as a freshly created Uno does not stick;
    // a short pause and a second edit does.
    await page.waitForTimeout(800);
    codeSaved = await page.evaluate(pageSetCode, code);
  }
  if (!(await waitForSave(page))) result.errors.push("Tinkercad did not confirm the save within 30 s; reload the design and check it.");
  // The simulator keeps running the previous circuit until the editor is reloaded.
  await reloadEditor(page);
  return { ...result, codeSaved };
}

export async function setCode(code: string): Promise<boolean> {
  const page = await editorPage();
  await stopSimulationIfRunning(page);
  const ok = await page.evaluate(pageSetCode, code);
  await waitForSave(page);
  await reloadEditor(page);
  return ok;
}

const typeOf = new Map(PARTS.map((p) => [p.did, p.id]));

export async function readCircuit(): Promise<Omit<ReadResult, "parts"> & { url: string; title: string; parts: (ReadResult["parts"][number] & { type: string })[] }> {
  const page = await editorPage();
  const r = await page.evaluate(pageRead);
  return {
    ...r,
    url: page.url().split("?")[0],
    title: await circuitTitle(page),
    parts: r.parts.map((p) => ({ ...p, type: typeOf.get(p.did) ?? `did:${p.did}` })),
  };
}

export async function stopSimulationIfRunning(page: Page): Promise<void> {
  const stop = page.getByText("Stop Simulation").first();
  if (await stop.isVisible().catch(() => false)) {
    await stop.click();
    await page.waitForTimeout(800);
  }
}

/** Clicks the editor's zoom-to-fit button so the whole circuit is on screen. */
export async function zoomToFit(page: Page): Promise<void> {
  await page.mouse.click(24, 120);
  await page.waitForTimeout(600);
}

export async function screenshot(): Promise<{ path: string; png: Buffer }> {
  const page = await getPage();
  const png = await page.screenshot();
  const dir = path.join(os.tmpdir(), "tinkercad-circuits-mcp");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `circuit-${Date.now()}.png`);
  await fs.writeFile(file, png);
  return { path: file, png };
}

export async function signInStatus(): Promise<{ signedIn: boolean; url: string }> {
  return checkSignedIn(await getPage());
}
