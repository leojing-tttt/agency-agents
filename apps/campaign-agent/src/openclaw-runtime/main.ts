import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { OpenClawDevGateway } from "./server.ts";
import type { OpenClawDevConfig } from "./config.ts";

async function main() {
  const configArg = process.argv.find((item) => item.startsWith("--config="))
    ?? (process.argv.includes("--config") ? process.argv[process.argv.indexOf("--config") + 1] : undefined);
  const configPath = configArg?.replace(/^--config=/, "") || process.env.OPENCLAW_CONFIG_PATH;
  if (!configPath) {
    console.error("usage: tsx src/openclaw-runtime/main.ts --config <openclaw.json>");
    process.exit(2);
  }
  const raw = await readFile(configPath, "utf8");
  const config = JSON.parse(raw) as OpenClawDevConfig;
  const gateway = new OpenClawDevGateway(config);
  const { port } = await gateway.listen();
  const stateDir = process.env.OPENCLAW_STATE_DIR;
  if (stateDir) {
    await writeFile(path.join(stateDir, "ready.json"), `${JSON.stringify({ port, pid: process.pid })}\n`);
  }
  const shutdown = async () => {
    await gateway.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => {
    void shutdown();
  });
  process.on("SIGINT", () => {
    void shutdown();
  });
  console.error(`openclaw-dev-gateway listening ws://127.0.0.1:${port} tenant=${config.tenant.tenant_id} controlUi=false`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
