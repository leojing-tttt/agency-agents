import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TenantRuntimeConfig } from "../campaign-core/types.ts";
import { buildOpenClawDevConfig } from "../openclaw-runtime/config.ts";
import { OpenClawGatewayClient, OpenClawGatewayUnavailableError } from "./openclaw-client.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const GATEWAY_MAIN = path.resolve(here, "../openclaw-runtime/main.ts");
const require = createRequire(import.meta.url);

export type SupervisedGateway = {
  tenantId: string;
  url: string;
  token: string;
  port: number;
  stateDir: string;
  configPath: string;
};

/**
 * Embedding host: spawn one OpenClaw-compatible Gateway child per tenant.
 * Child binds an ephemeral port and writes ready.json; readiness is then hello-ok.
 */
export class OpenClawSupervisor {
  private readonly children = new Map<
    string,
    { process: ChildProcess; gateway: SupervisedGateway }
  >();
  private readonly inflight = new Map<string, Promise<SupervisedGateway>>();

  async ensure(input: {
    tenant: TenantRuntimeConfig;
    skillsRoot: string;
  }): Promise<SupervisedGateway> {
    const existing = this.children.get(input.tenant.tenant_id);
    if (existing && existing.process.exitCode === null && !existing.process.killed) {
      return existing.gateway;
    }
    const pending = this.inflight.get(input.tenant.tenant_id);
    if (pending) {
      return pending;
    }
    const work = this.spawnOne(input).finally(() => {
      if (this.inflight.get(input.tenant.tenant_id) === work) {
        this.inflight.delete(input.tenant.tenant_id);
      }
    });
    this.inflight.set(input.tenant.tenant_id, work);
    return work;
  }

  private async spawnOne(input: {
    tenant: TenantRuntimeConfig;
    skillsRoot: string;
  }): Promise<SupervisedGateway> {
    const stale = this.children.get(input.tenant.tenant_id);
    if (stale) {
      await this.stop(input.tenant.tenant_id);
    }
    const token = randomBytes(24).toString("hex");
    const stateDir = path.join(
      os.tmpdir(),
      `campaign-openclaw-${input.tenant.tenant_id}-${randomBytes(6).toString("hex")}`,
    );
    await mkdir(stateDir, { recursive: true });
    const workspace = path.join(stateDir, "workspace");
    await mkdir(workspace, { recursive: true });
    const config = buildOpenClawDevConfig({
      tenant: input.tenant,
      skillsRoot: input.skillsRoot,
      workspace,
      port: 0,
      token,
    });
    const configPath = path.join(stateDir, "openclaw.json");
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

    const tsxCli = require.resolve("tsx/cli");
    const child = spawn(process.execPath, [tsxCli, GATEWAY_MAIN, "--config", configPath], {
      env: {
        ...process.env,
        OPENCLAW_DISABLE_BONJOUR: "1",
        OPENCLAW_EXEC_SHELL_SNAPSHOT: "0",
        OPENCLAW_NO_RESPAWN: "1",
        OPENCLAW_SKIP_CHANNELS: "1",
        OPENCLAW_CONFIG_PATH: configPath,
        OPENCLAW_STATE_DIR: stateDir,
        OPENCLAW_GATEWAY_TOKEN: token,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stderr: string[] = [];
    child.stdout?.on("data", () => {
      /* inherit consumption so the child cannot block */
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderr.push(text);
      if (stderr.length > 40) {
        stderr.shift();
      }
    });

    const placeholder: SupervisedGateway = {
      tenantId: input.tenant.tenant_id,
      url: "",
      token,
      port: 0,
      stateDir,
      configPath,
    };
    this.children.set(input.tenant.tenant_id, { process: child, gateway: placeholder });

    child.once("exit", () => {
      const current = this.children.get(input.tenant.tenant_id);
      if (current?.process === child) {
        this.children.delete(input.tenant.tenant_id);
      }
    });

    try {
      const port = await waitForReadyFile(stateDir, child, stderr);
      const gateway: SupervisedGateway = {
        ...placeholder,
        port,
        url: `ws://127.0.0.1:${port}`,
      };
      const current = this.children.get(input.tenant.tenant_id);
      if (current?.process === child) {
        current.gateway = gateway;
      }
      await waitForHello(gateway, child, stderr);
      return gateway;
    } catch (err) {
      await this.stop(input.tenant.tenant_id);
      throw err;
    }
  }

  async stop(tenantId: string): Promise<void> {
    const current = this.children.get(tenantId);
    if (!current) {
      return;
    }
    this.children.delete(tenantId);
    await killChild(current.process);
  }

  async stopAll(): Promise<void> {
    const ids = [...this.children.keys()];
    await Promise.all(ids.map((id) => this.stop(id)));
  }
}

async function waitForReadyFile(stateDir: string, child: ChildProcess, stderr: string[]): Promise<number> {
  const readyPath = path.join(stateDir, "ready.json");
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new OpenClawGatewayUnavailableError(
        `openclaw_gateway_unavailable: child exited ${child.exitCode} ${stderr.join("")}`.trim(),
      );
    }
    try {
      const raw = await readFile(readyPath, "utf8");
      const parsed = JSON.parse(raw) as { port?: number };
      if (typeof parsed.port === "number" && parsed.port > 0) {
        return parsed.port;
      }
    } catch {
      /* not written yet */
    }
    await sleep(40);
  }
  throw new OpenClawGatewayUnavailableError(
    `openclaw_gateway_unavailable: ready.json not written ${stderr.join("")}`.trim(),
  );
}

async function waitForHello(
  gateway: SupervisedGateway,
  child: ChildProcess,
  stderr: string[],
): Promise<void> {
  const deadline = Date.now() + 12000;
  let last: Error | undefined;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new OpenClawGatewayUnavailableError(
        `openclaw_gateway_unavailable: child exited ${child.exitCode} ${stderr.join("")}`.trim(),
      );
    }
    try {
      const client = await OpenClawGatewayClient.connect({
        url: gateway.url,
        token: gateway.token,
        timeoutMs: 1500,
      });
      client.close();
      return;
    } catch (err) {
      last = err instanceof Error ? err : new Error(String(err));
      await sleep(80);
    }
  }
  throw new OpenClawGatewayUnavailableError(
    `openclaw_gateway_unavailable: hello-ok not received (${last?.message ?? "timeout"}) ${stderr.join("")}`.trim(),
  );
}

function killChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.killed) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 2000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
