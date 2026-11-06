// `npm run login`: opens Chrome on the Tinkercad sign-in page and waits until you
// have signed in. The session stays in the browser profile; nothing else is stored.
import { launch, looksSignedIn, PROFILE_DIR, TINKERCAD, closeBrowser } from "./browser.js";

const TIMEOUT_MS = 10 * 60 * 1000;

export async function runLogin(): Promise<void> {
  const ctx = await launch(false);
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(`${TINKERCAD}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  if (looksSignedIn(page.url())) {
    console.log("Already signed in to Tinkercad. Profile:", PROFILE_DIR);
    await closeBrowser();
    return;
  }
  console.log("Sign in to Tinkercad in the Chrome window that just opened.");
  console.log("This script only watches the address bar and closes the window when you reach your dashboard.");
  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    await page.waitForTimeout(2000);
    if (page.isClosed()) throw new Error("The window was closed before sign-in finished.");
    if (looksSignedIn(page.url())) {
      await page.waitForTimeout(3000); // let cookies settle
      console.log("Signed in. Profile saved at", PROFILE_DIR);
      await closeBrowser();
      return;
    }
  }
  throw new Error("Timed out after 10 minutes waiting for sign-in.");
}

// run directly: node dist/login.js
if (process.argv[1] && /login\.js$/.test(process.argv[1])) {
  runLogin().catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await closeBrowser().catch(() => {});
    process.exit(1);
  });
}
