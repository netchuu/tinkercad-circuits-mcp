#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";
import { closeBrowser } from "./browser.js";

if (process.argv[2] === "login") {
  const { runLogin } = await import("./login.js");
  await runLogin().catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await closeBrowser().catch(() => {});
    process.exit(1);
  });
  process.exit(0);
}

const server = new McpServer({ name: "tinkercad-circuits", version: "0.1.0" });
registerTools(server);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => { closeBrowser().finally(() => process.exit(0)); });
}

await server.connect(new StdioServerTransport());
