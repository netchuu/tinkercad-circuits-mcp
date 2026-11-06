# Troubleshooting

**`tinkercad_status` says signed in is false.**
Run `npm run login` and sign in in the window it opens. Use whatever sign-in you normally use for Tinkercad; you are typing into a normal Chrome window. Finish any extra steps (two-factor, consent pages) until you see your dashboard.

**"The browser profile ... is already open".**
Only one process can use the profile. Close the Chrome window the server opened, or stop the other MCP client that is using it. If you run the server from two clients, give each its own profile with `TINKERCAD_PROFILE_DIR`.

**"Could not start chrome".**
Install Google Chrome, or point the server at another Chromium browser: `TINKERCAD_BROWSER_CHANNEL=msedge`. Playwright's own Chromium also works (`npx playwright-core install chromium`, then `TINKERCAD_BROWSER_CHANNEL=chromium`), but Google may refuse a Google-account sign-in in it.

**I'm signed in, but after a restart I'm signed out again.**
On macOS Chrome encrypts cookies with the login keychain. The server starts Chrome without Playwright's mock keychain for exactly this reason; if you start the profile some other way, it can lose the session. Sign in again with `npm run login`.

**A part could not be placed.**
The error says which part and at which hole. Usually the part is too close to the edge or the other legs would cross the centre gap. Move it, or set `angle` so it lies the way you want.

**The circuit looks right but the simulation does nothing.**
- Check that the rails are powered: `["uno.GND1", "T-"]`, and `["uno.5V", "T+"]` if anything needs 5 V.
- Check the code was saved: `tinkercad_build_circuit` returns `codeSaved`, and `tinkercad_get_circuit` shows the code.
- Look at the Code panel in Tinkercad for compile errors; the server does not report them yet.

**LED readings look wrong.**
The LED has to be on screen. The server zooms to fit before simulating; if the window is very small, make it bigger. Sample in the middle of a state, not at the moment it changes.

**Button presses are ignored.**
Hold for at least 0.6 s, longer if the sketch is inside a long `delay()` when you press.

**Serial commands are ignored.**
The Send button does not add a newline. See [Serial input](simulation.md#serial-input).

**Something used to work and now fails everywhere.**
Tinkercad probably changed. Run `npm run smoke`; the first failing check tells you which part of [How it works](how-it-works.md) moved. Please open an issue with the output.
