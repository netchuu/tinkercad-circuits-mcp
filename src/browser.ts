// One persistent Chrome window, shared by every tool call.
// The profile keeps the Tinkercad login between runs, so you sign in once with `npm run login`.
import os from "node:os";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright-core";

export const PROFILE_DIR = process.env.TINKERCAD_PROFILE_DIR
  ?? path.join(os.homedir(), ".tinkercad-circuits-mcp", "profile");
const CHANNEL = process.env.TINKERCAD_BROWSER_CHANNEL ?? "chrome";
const HEADLESS = process.env.TINKERCAD_HEADLESS === "1";

export const TINKERCAD = "https://www.tinkercad.com";

let context: BrowserContext | undefined;
let page: Page | undefined;

export async function launch(headless = HEADLESS): Promise<BrowserContext> {
  if (context) return context;
  try {
    context = await chromium.launchPersistentContext(PROFILE_DIR, {
      channel: CHANNEL,
      headless,
      viewport: { width: 1440, height: 900 },
      // With the default automation flags Chrome uses a mock keychain on macOS and
      // the saved login cookies cannot be decrypted on the next start.
      ignoreDefaultArgs: ["--use-mock-keychain", "--enable-automation"],
      args: ["--disable-blink-features=AutomationControlled"],
    });
  } catch (err) {
    const msg = String(err);
    if (msg.includes("ProcessSingleton") || msg.includes("already in use")) {
      throw new Error(`The browser profile at ${PROFILE_DIR} is already open in another window or process. Close it and try again.`);
    }
    if (msg.includes("Chromium distribution") || msg.includes("is not found")) {
      throw new Error(`Could not start "${CHANNEL}". Install Google Chrome, or set TINKERCAD_BROWSER_CHANNEL (e.g. "msedge").`);
    }
    throw err;
  }
  context.on("close", () => { context = undefined; page = undefined; });
  return context;
}

export async function getPage(): Promise<Page> {
  const ctx = await launch();
  if (!page || page.isClosed()) page = ctx.pages()[0] ?? (await ctx.newPage());
  return page;
}

export async function closeBrowser(): Promise<void> {
  await context?.close();
  context = undefined;
  page = undefined;
}

/** True when the page is on a signed-in Tinkercad dashboard (no redirect to a login page). */
export function looksSignedIn(url: string): boolean {
  return url.startsWith(`${TINKERCAD}/dashboard`) && !/login|signin|auth/i.test(url);
}

export async function checkSignedIn(p: Page): Promise<{ signedIn: boolean; url: string }> {
  await p.goto(`${TINKERCAD}/dashboard`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  return { signedIn: looksSignedIn(p.url()), url: p.url() };
}
