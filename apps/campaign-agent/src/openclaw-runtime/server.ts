import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { newId } from "../campaign-core/ids.ts";
import { SkillLibrary, SkillLoadError, type LoadedSkill, type SkillSummary } from "../harness/skill-loader.ts";
import { routeSkillTurn, type SkillTurnResult } from "../harness/skill-turn.ts";
import type { OpenClawDevConfig } from "./config.ts";
import {
  eventFrame,
  newChallenge,
  OPENCLAW_PROTOCOL,
  parseFrame,
  resErr,
  resOk,
  type ConnectChallenge,
} from "./protocol.ts";

type AgentEntry = OpenClawDevConfig["agents"]["entries"][string];

type SessionRecord = {
  sessionId: string;
  sessionKey: string;
  agentId: string;
  catalog: SkillSummary[];
};

type RunRecord = {
  runId: string;
  status: "ok" | "error";
  startedAt: number;
  endedAt: number;
  result?: SkillTurnResult;
  error?: string;
};

const METHODS = [
  "skills.status",
  "tools.catalog",
  "tools.effective",
  "tools.invoke",
  "sessions.create",
  "sessions.list",
  "agent",
  "agent.wait",
] as const;

export class OpenClawDevGateway {
  private readonly library: SkillLibrary;
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly runs = new Map<string, RunRecord>();
  private httpServer: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  readonly config: OpenClawDevConfig;

  constructor(config: OpenClawDevConfig) {
    this.config = config;
    const extra = config.skills.load.extraDirs[0];
    if (!extra) {
      throw new Error("openclaw_config: skills.load.extraDirs is required");
    }
    this.library = new SkillLibrary(extra);
  }

  async listen(): Promise<{ port: number }> {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (url.pathname === "/healthz") {
        json(res, 200, { ok: true, service: "openclaw-gateway" });
        return;
      }
      if (url.pathname === "/readyz") {
        json(res, 200, { ready: true, controlUi: false });
        return;
      }
      // Control UI is not part of this product. Refuse HTML dashboard routes.
      json(res, 404, {
        error: "control_ui_disabled",
        message: "This OpenClaw runtime does not serve Control UI, WhatsApp, or channels.",
      });
    });
    this.httpServer = server;
    this.wss = new WebSocketServer({ server });
    this.wss.on("connection", (socket) => {
      void this.handleSocket(socket);
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(this.config.gateway.port, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : this.config.gateway.port;
    return { port };
  }

  async close(): Promise<void> {
    this.wss?.close();
    await new Promise<void>((resolve) => {
      if (!this.httpServer) {
        resolve();
        return;
      }
      this.httpServer.close(() => resolve());
    });
  }

  private async handleSocket(socket: WebSocket): Promise<void> {
    const challenge = newChallenge();
    const state = { authed: false };
    socket.send(eventFrame("connect.challenge", challenge));
    socket.on("message", (data) => {
      void this.onMessage(socket, data.toString(), challenge, state).catch((err: unknown) => {
        socket.send(
          resErr("0", "UNAVAILABLE", err instanceof Error ? err.message : "gateway_error"),
        );
      });
    });
    socket.on("error", () => {
      /* client dropped */
    });
  }

  private async onMessage(
    socket: WebSocket,
    raw: string,
    challenge: ConnectChallenge,
    state: { authed: boolean },
  ): Promise<void> {
    let frame;
    try {
      frame = parseFrame(raw);
    } catch {
      socket.send(resErr("0", "INVALID_REQUEST", "invalid_gateway_frame"));
      return;
    }
    if (frame.type !== "req") {
      return;
    }
    if (frame.method === "connect") {
      const result = this.handleConnect(frame.params ?? {}, challenge);
      if (!result.ok) {
        socket.send(resErr(frame.id, result.code, result.message));
        socket.close(1008, result.message);
        return;
      }
      state.authed = true;
      socket.send(resOk(frame.id, result.payload));
      return;
    }
    if (!state.authed) {
      socket.send(resErr(frame.id, "UNAUTHENTICATED", "connect required before RPC"));
      socket.close(1008, "unauthorized: gateway token missing");
      return;
    }
    try {
      const payload = await this.dispatch(frame.method, frame.params ?? {});
      socket.send(resOk(frame.id, payload));
    } catch (err) {
      const message = err instanceof Error ? err.message : "gateway_error";
      const code = err instanceof SkillLoadError ? "INVALID_REQUEST" : "UNAVAILABLE";
      socket.send(resErr(frame.id, code, message));
    }
  }

  private handleConnect(
    params: Record<string, unknown>,
    challenge: ConnectChallenge,
  ):
    | { ok: true; payload: Record<string, unknown> }
    | { ok: false; code: string; message: string } {
    const minProtocol = Number(params.minProtocol ?? OPENCLAW_PROTOCOL);
    const maxProtocol = Number(params.maxProtocol ?? OPENCLAW_PROTOCOL);
    if (minProtocol > OPENCLAW_PROTOCOL || maxProtocol < OPENCLAW_PROTOCOL) {
      return { ok: false, code: "INVALID_REQUEST", message: "protocol_mismatch" };
    }
    const auth = (params.auth ?? {}) as { token?: string };
    if (auth.token !== this.config.gateway.auth.token) {
      return { ok: false, code: "UNAUTHENTICATED", message: "unauthorized: gateway token missing or invalid" };
    }
    const client = (params.client ?? {}) as { id?: string; mode?: string; version?: string };
    return {
      ok: true,
      payload: {
        type: "hello-ok",
        protocol: OPENCLAW_PROTOCOL,
        server: { version: "campaign-agent-openclaw-dev/0.2.0", connId: newId("conn") },
        features: { methods: [...METHODS], events: ["connect.challenge", "agent", "shutdown"] },
        snapshot: {
          presence: [],
          health: "live",
          stateVersion: 1,
          uptimeMs: 0,
          challengeTs: challenge.ts,
          tenantId: this.config.tenant.tenant_id,
          controlUi: false,
          channels: [],
          selfLearningMemory: false,
        },
        auth: {
          role: "operator",
          scopes: ["operator.read", "operator.write", "operator.admin"],
        },
        policy: {
          maxPayload: 26214400,
          maxBufferedBytes: 52428800,
          tickIntervalMs: 15000,
          attachments: { maxBytes: 20971520, maxImageBytes: 6291456 },
        },
        client: { id: client.id ?? "gateway-client", mode: client.mode ?? "backend" },
      },
    };
  }

  private async dispatch(method: string, params: Record<string, unknown>): Promise<unknown> {
    switch (method) {
      case "skills.status":
        return this.skillsStatus(String(params.agentId ?? ""));
      case "tools.catalog":
        return this.toolsCatalog(String(params.agentId ?? ""));
      case "tools.effective":
        return this.toolsEffective(String(params.sessionKey ?? ""), String(params.agentId ?? ""));
      case "tools.invoke":
        return this.toolsInvoke(params);
      case "sessions.create":
        return this.sessionsCreate(params);
      case "sessions.list":
        return { sessions: [...this.sessions.values()].map(publicSession) };
      case "agent":
        return this.agent(params);
      case "agent.wait":
        return this.agentWait(String(params.runId ?? ""));
      default:
        throw new Error(`method_not_found: ${method}`);
    }
  }

  private agentEntry(agentId: string): AgentEntry {
    const entry = this.config.agents.entries[agentId];
    if (!entry) {
      throw new Error(`agent_not_published: ${agentId}`);
    }
    return entry;
  }

  private async skillsStatus(agentId: string): Promise<{ skills: SkillSummary[]; agentId: string }> {
    const entry = this.agentEntry(agentId);
    const allowlist = entry.skillPins;
    const catalog = await this.library.catalog(allowlist);
    return {
      agentId,
      skills: catalog.map(({ name, description, version, dir }) => ({ name, description, version, dir })),
    };
  }

  private toolsCatalog(agentId: string): { groups: unknown[] } {
    const entry = this.agentEntry(agentId);
    return { groups: [mcpGroup(entry.tools.allow)] };
  }

  private toolsEffective(sessionKey: string, agentId: string): { sessionKey: string; groups: unknown[]; notices: string[] } {
    const session = sessionKey ? this.sessions.get(sessionKey) : undefined;
    const id = session?.agentId || agentId;
    const entry = this.agentEntry(id);
    return {
      sessionKey: session?.sessionKey || sessionKey,
      groups: [mcpGroup(entry.tools.allow)],
      notices: ["mcp-not-yet-connected"],
    };
  }

  private toolsInvoke(params: Record<string, unknown>): { ok: false; toolName: string; error: { code: string; message: string } } {
    const name = String(params.name ?? params.tool ?? "");
    const agentId = String(params.agentId ?? "");
    const sessionKey = String(params.sessionKey ?? "");
    const session = sessionKey ? this.sessions.get(sessionKey) : undefined;
    const entry = this.agentEntry(session?.agentId || agentId);
    if (!entry.tools.allow.includes(name)) {
      return {
        ok: false,
        toolName: name,
        error: { code: "mcp_not_allowed", message: `mcp_not_allowed: ${name}` },
      };
    }
    return {
      ok: false,
      toolName: name,
      error: {
        code: "mcp_not_connected",
        message: "MCP servers are allowlisted per agent but not connected in this slice",
      },
    };
  }

  private async sessionsCreate(params: Record<string, unknown>): Promise<{ sessionId: string; sessionKey: string; agentId: string }> {
    const agentId = String(params.agentId ?? "");
    const entry = this.agentEntry(agentId);
    const sessionKey =
      String(params.sessionKey ?? "") || `agent:${agentId}:session:${newId("ses")}`;
    const existing = this.sessions.get(sessionKey);
    if (existing) {
      return publicSession(existing);
    }
    const allowlist = entry.skillPins;
    const catalog = await this.library.catalog(allowlist);
    const record: SessionRecord = {
      sessionId: newId("ses"),
      sessionKey,
      agentId,
      catalog,
    };
    this.sessions.set(sessionKey, record);
    return publicSession(record);
  }

  private async agent(params: Record<string, unknown>): Promise<{ runId: string; acceptedAt: number; status: "accepted" }> {
    const agentId = String(params.agentId ?? "");
    const sessionKey = String(params.sessionKey ?? "");
    const created = await this.sessionsCreate({ agentId, sessionKey });
    const session = this.sessions.get(created.sessionKey);
    if (!session) {
      throw new Error("session_missing");
    }
    const startedAt = Date.now();
    const runId = String(params.idempotencyKey ?? newId("run"));
    const attachments = normalizeAttachments(params.attachments);
    const message = typeof params.message === "string" ? params.message : undefined;
    const entry = this.agentEntry(session.agentId);
    const activateSkill = async (name: string): Promise<LoadedSkill> => {
      if (!entry.skills.includes(name)) {
        throw new SkillLoadError(`skill_not_allowed_or_missing: ${name}`);
      }
      return this.library.activate(name, entry.skillPins);
    };
    try {
      const result = await routeSkillTurn({
        catalog: session.catalog,
        activateSkill,
        turn: {
          text: message,
          attachment: attachments[0],
        },
      });
      this.runs.set(runId, {
        runId,
        status: "ok",
        startedAt,
        endedAt: Date.now(),
        result,
      });
    } catch (err) {
      this.runs.set(runId, {
        runId,
        status: "error",
        startedAt,
        endedAt: Date.now(),
        error: err instanceof Error ? err.message : "agent_error",
      });
    }
    return { runId, acceptedAt: startedAt, status: "accepted" };
  }

  private agentWait(runId: string): Record<string, unknown> {
    const run = this.runs.get(runId);
    if (!run) {
      return { status: "pending", runId };
    }
    if (run.status === "error") {
      return {
        status: "error",
        runId,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        error: run.error,
      };
    }
    return {
      status: "ok",
      runId,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      result: serializeTurn(run.result),
    };
  }
}

function publicSession(session: SessionRecord) {
  return { sessionId: session.sessionId, sessionKey: session.sessionKey, agentId: session.agentId };
}

function mcpGroup(handles: string[]) {
  return {
    id: "mcp",
    label: "MCP",
    source: "mcp",
    tools: handles.map((handle) => {
      const [server, name] = handle.split("/");
      return {
        id: handle,
        label: handle,
        description: "",
        rawDescription: "",
        source: "mcp",
        mcpServer: server,
        mcpToolName: name,
      };
    }),
  };
}

function normalizeAttachments(value: unknown): { filename: string; bytes: Uint8Array }[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: { filename: string; bytes: Uint8Array }[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const rec = item as { fileName?: string; filename?: string; content?: unknown; mimeType?: string };
    const filename = String(rec.fileName || rec.filename || "brief.txt");
    const content = rec.content;
    let bytes: Uint8Array;
    if (typeof content === "string") {
      bytes = Buffer.from(content, "base64");
    } else if (content instanceof Uint8Array) {
      bytes = content;
    } else {
      continue;
    }
    out.push({ filename, bytes });
  }
  return out;
}

function serializeTurn(result: SkillTurnResult | undefined) {
  if (!result) {
    return null;
  }
  const loaded = result.loaded_skill;
  return {
    routed_skill: result.routed_skill,
    status: result.status,
    notes: result.notes,
    parsed: result.parsed ?? null,
    loaded_skill: loaded
      ? {
          name: loaded.name,
          description: loaded.description,
          version: loaded.version,
          dir: loaded.dir,
          frontmatter: loaded.frontmatter,
          instructions: loaded.instructions,
          bundled: loaded.bundled,
          files: loaded.files,
        }
      : null,
  };
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
