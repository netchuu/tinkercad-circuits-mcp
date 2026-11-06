# Notes for coding agents

Working on this repo (not installing it? see the Setup section of README.md).

- `npm install`, `npm run build`, `npm test` (unit tests, no browser).
- `npm run smoke` builds and simulates circuits in a real Tinkercad account. It needs a signed-in profile (`npm run login`, done by a person) and creates a design called "tinkercad-circuits-mcp smoke test". Do not run it without asking.
- `src/page.ts` runs inside the Tinkercad editor page. Each exported function is serialised on its own, so it cannot use imports or helpers from the module.
- After adding or changing a part in `src/catalog.ts`, run `npm run parts-doc`.
- docs/how-it-works.md explains the Tinkercad internals the code depends on.
