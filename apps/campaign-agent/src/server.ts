import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CampaignCore } from "./campaign-core/index.ts";
import { OpenClawGatewayAdapter } from "./harness/openclaw-adapter.ts";
import { OpenClawSupervisor } from "./harness/openclaw-supervisor.ts";
import { demoTenant, isolateRuntime, SKILLS_ROOT } from "./harness/tenant-runtime.ts";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(APP_ROOT, "public");
const PORT = Number(process.env.PORT || 4173);

const tenant = demoTenant();
const core = new CampaignCore();
const seeded = core.createCampaign({
  tenant_id: tenant.tenant_id,
  name: "美妆精华 Q3 种草",
});
const supervisor = new OpenClawSupervisor();
const harness = new OpenClawGatewayAdapter({ core, supervisor });

type Sessions = Map<string, Awaited<ReturnType<OpenClawGatewayAdapter["createSession"]>>>;
const sessions: Sessions = new Map();
const creatingSessions = new Map<string, Promise<Awaited<ReturnType<OpenClawGatewayAdapter["createSession"]>>>>();

async function sessionFor(campaignId: string, agentId = "beauty-essence-campaign") {
  const key = `${campaignId}:${agentId}`;
  const existing = sessions.get(key);
  if (existing) {
    return existing;
  }
  const pending = creatingSessions.get(key);
  if (pending) {
    return pending;
  }
  const work = (async () => {
    const runtime = isolateRuntime(tenant, agentId, SKILLS_ROOT);
    const created = await harness.createSession(runtime, campaignId);
    sessions.set(key, created);
    return created;
  })().finally(() => {
    creatingSessions.delete(key);
  });
  creatingSessions.set(key, work);
  return work;
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function notFound(res: http.ServerResponse) {
  json(res, 404, { error: "not_found" });
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function parseMultipart(buf: Buffer, contentType: string): { filename: string; bytes: Uint8Array } {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = match?.[1] || match?.[2];
  if (!boundary) {
    throw new Error("multipart_boundary_missing");
  }
  const parts = buf.toString("latin1").split(`--${boundary}`);
  for (const part of parts) {
    if (!/name="file"/i.test(part)) {
      continue;
    }
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd < 0) {
      continue;
    }
    const headers = part.slice(0, headerEnd);
    const filename = /filename="([^"]+)"/i.exec(headers)?.[1] || "brief.txt";
    let body = part.slice(headerEnd + 4);
    if (body.endsWith("\r\n")) {
      body = body.slice(0, -2);
    }
    return { filename, bytes: Buffer.from(body, "latin1") };
  }
  throw new Error("multipart_file_missing");
}

async function serveStatic(urlPath: string, res: http.ServerResponse) {
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    const types: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
    };
    res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    notFound(res);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
    if (req.method === "GET" && !url.pathname.startsWith("/api/")) {
      await serveStatic(url.pathname, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/meta") {
      const session = await sessionFor(seeded.campaign_id);
      json(res, 200, {
        tenant: { id: tenant.tenant_id, name: tenant.display_name },
        campaign: seeded,
        agent: { id: "beauty-essence-campaign", version: "1" },
        harness: "openclaw-gateway",
        skills: session.skillCatalog().map(({ name, description, version }) => ({
          name,
          description,
          version,
        })),
        mcp: session.mcpTools(),
        real_vs_adapter: {
          real: [
            "OpenClaw-compatible Gateway process (WS protocol v4, hello-ok readiness)",
            "per-tenant isolated Gateway child (not one shared tool dump)",
            "Agent Skills SKILL.md loading via Gateway skills.status + session snapshot",
            "campaign-core versioned Brief + memory pins",
            "drop-Brief agent + agent.wait turn",
          ],
          not_shipped: [
            "Official 200MB openclaw npm binary (Node >=24)",
            "OpenClaw Control UI",
            "WhatsApp channels",
            "self-learning memory",
            "plan/talent/content skills",
          ],
        },
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/campaign") {
      json(res, 200, core.snapshot(tenant.tenant_id, seeded.campaign_id));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/brief") {
      const contentType = req.headers["content-type"] || "";
      let filename = "brief.txt";
      let bytes: Uint8Array;
      if (contentType.includes("multipart/form-data")) {
        const parsed = parseMultipart(await readBody(req), contentType);
        filename = parsed.filename;
        bytes = parsed.bytes;
      } else {
        bytes = await readBody(req);
        filename = url.searchParams.get("filename") || "brief.txt";
      }
      const session = await sessionFor(seeded.campaign_id);
      const turn = await session.turn({ attachment: { filename, bytes } });
      json(res, 200, { turn, snapshot: core.snapshot(tenant.tenant_id, seeded.campaign_id) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/content-packs") {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}") as {
        locked_row_id?: string;
      };
      try {
        const pack = core.createContentPack({
          tenant_id: tenant.tenant_id,
          campaign_id: seeded.campaign_id,
          locked_row_id: body.locked_row_id || "",
        });
        json(res, 200, { pack, snapshot: core.snapshot(tenant.tenant_id, seeded.campaign_id) });
      } catch (err) {
        json(res, 409, { error: (err as Error).message });
      }
      return;
    }

    notFound(res);
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
});

async function shutdown() {
  await Promise.all([...sessions.values()].map((session) => session.close()));
  sessions.clear();
  await harness.stop();
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

server.listen(PORT, () => {
  console.log(`campaign-agent demo http://127.0.0.1:${PORT}`);
  console.log(`tenant=${tenant.tenant_id} campaign=${seeded.campaign_id}`);
  console.log("harness=openclaw-gateway (Control UI / WhatsApp / self-memory not shipped)");
});
