import { newId } from "../campaign-core/ids.ts";
import {
  OPENCLAW_PROTOCOL,
  parseFrame,
  reqFrame,
  type GatewayFrame,
} from "../openclaw-runtime/protocol.ts";
import type { LoadedSkill, SkillSummary } from "./skill-loader.ts";
import type { SkillTurnResult } from "./skill-turn.ts";
import { WebSocket as NodeWebSocket } from "ws";

export class OpenClawGatewayUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenClawGatewayUnavailableError";
  }
}

export type GatewayHello = {
  protocol: number;
  server: { version: string; connId: string };
  features: { methods: string[]; events: string[] };
  snapshot: Record<string, unknown>;
  auth: { role: string; scopes: string[] };
};

export type AgentWaitResult = {
  status: "ok" | "error" | "pending" | "timeout";
  runId: string;
  startedAt?: number;
  endedAt?: number;
  error?: string;
  result?: SkillTurnResult | null;
};

/**
 * Operator client for the OpenClaw Gateway WebSocket protocol (wire v4).
 * Handshake: wait for connect.challenge, send connect with token, treat hello-ok as ready.
 * Uses the `ws` package so Node 20+ works (global WebSocket is not enabled there).
 */
export class OpenClawGatewayClient {
  private reqId = 0;
  private readonly pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (err: Error) => void }
  >();

  private constructor(
    private readonly ws: NodeWebSocket,
    readonly hello: GatewayHello,
    readonly url: string,
  ) {}

  static async connect(input: {
    url: string;
    token: string;
    timeoutMs?: number;
  }): Promise<OpenClawGatewayClient> {
    const timeoutMs = input.timeoutMs ?? 8000;
    let ws: NodeWebSocket;
    try {
      ws = new NodeWebSocket(input.url);
    } catch (err) {
      throw new OpenClawGatewayUnavailableError(
        `openclaw_gateway_unavailable: ${err instanceof Error ? err.message : "websocket_construct_failed"}`,
      );
    }

    const clientHolder: { client?: OpenClawGatewayClient } = {};
    const challengeBox: { nonce?: string; ts?: number; waiters: Array<() => void> } = { waiters: [] };

    return new Promise<OpenClawGatewayClient>((resolve, reject) => {
      let settled = false;
      const finish = (err?: Error, client?: OpenClawGatewayClient) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        if (err) {
          reject(err);
          return;
        }
        resolve(client as OpenClawGatewayClient);
      };

      const timer = setTimeout(() => {
        ws.terminate();
        finish(new OpenClawGatewayUnavailableError("openclaw_gateway_unavailable: hello-ok timeout"));
      }, timeoutMs);

      ws.on("error", () => {
        if (!clientHolder.client) {
          finish(new OpenClawGatewayUnavailableError(`openclaw_gateway_unavailable: cannot connect ${input.url}`));
        }
      });
      ws.on("close", (code) => {
        const client = clientHolder.client;
        if (client) {
          client.failAll(new OpenClawGatewayUnavailableError("openclaw_gateway_unavailable: connection closed"));
          return;
        }
        finish(
          new OpenClawGatewayUnavailableError(
            `openclaw_gateway_unavailable: closed before hello-ok (${code})`,
          ),
        );
      });
      ws.on("message", (data) => {
        let frame: GatewayFrame;
        try {
          frame = parseFrame(frameRaw(data));
        } catch {
          return;
        }
        if (frame.type === "event" && frame.event === "connect.challenge") {
          const payload = frame.payload as { nonce?: string; ts?: number };
          challengeBox.nonce = payload.nonce;
          challengeBox.ts = payload.ts;
          for (const wake of challengeBox.waiters) {
            wake();
          }
          challengeBox.waiters = [];
          return;
        }
        const client = clientHolder.client;
        if (client && frame.type === "res") {
          client.takeRes(frame);
        }
      });
      ws.on("open", () => {
        void (async () => {
          try {
            await waitChallenge(challengeBox, timeoutMs);
            const id = "connect-1";
            const connectP = waitRes(ws, id, timeoutMs);
            ws.send(
              reqFrame(id, "connect", {
                minProtocol: OPENCLAW_PROTOCOL,
                maxProtocol: OPENCLAW_PROTOCOL,
                client: {
                  id: "gateway-client",
                  version: "0.2.0",
                  platform: "node",
                  mode: "backend",
                },
                role: "operator",
                scopes: ["operator.read", "operator.write", "operator.admin"],
                caps: [],
                commands: [],
                permissions: {},
                auth: { token: input.token },
                locale: "zh-CN",
                userAgent: "campaign-agent-openclaw-client/0.2.0",
              }),
            );
            const hello = (await connectP) as GatewayHello;
            if (typeof hello?.protocol !== "number") {
              throw new OpenClawGatewayUnavailableError("openclaw_gateway_unavailable: missing hello-ok");
            }
            const client = new OpenClawGatewayClient(ws, hello, input.url);
            clientHolder.client = client;
            finish(undefined, client);
          } catch (err) {
            ws.terminate();
            finish(
              err instanceof OpenClawGatewayUnavailableError
                ? err
                : new OpenClawGatewayUnavailableError(
                    `openclaw_gateway_unavailable: ${err instanceof Error ? err.message : "connect failed"}`,
                  ),
            );
          }
        })();
      });
    });
  }

  async rpc<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    const id = `req-${++this.reqId}-${newId("id")}`;
    const payload = await new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.ws.send(reqFrame(id, method, params));
      } catch (err) {
        this.pending.delete(id);
        reject(
          new OpenClawGatewayUnavailableError(
            `openclaw_gateway_unavailable: ${err instanceof Error ? err.message : "send failed"}`,
          ),
        );
      }
    });
    return payload as T;
  }

  async skillsStatus(agentId: string): Promise<{ skills: SkillSummary[]; agentId: string }> {
    return this.rpc("skills.status", { agentId });
  }

  async toolsEffective(sessionKey: string, agentId: string): Promise<{
    sessionKey: string;
    groups: Array<{ tools: Array<{ id: string; mcpServer?: string; mcpToolName?: string }> }>;
  }> {
    return this.rpc("tools.effective", { sessionKey, agentId });
  }

  async sessionsCreate(agentId: string, sessionKey?: string): Promise<{
    sessionId: string;
    sessionKey: string;
    agentId: string;
  }> {
    return this.rpc("sessions.create", { agentId, sessionKey });
  }

  async agentTurn(input: {
    agentId: string;
    sessionKey: string;
    message?: string;
    attachment?: { filename: string; bytes: Uint8Array };
  }): Promise<AgentWaitResult> {
    const attachments = input.attachment
      ? [
          {
            type: "file",
            fileName: input.attachment.filename,
            mimeType: "application/octet-stream",
            content: Buffer.from(input.attachment.bytes).toString("base64"),
          },
        ]
      : [];
    const accepted = await this.rpc<{ runId: string; status: string }>("agent", {
      agentId: input.agentId,
      sessionKey: input.sessionKey,
      message: input.message,
      attachments,
      idempotencyKey: newId("run"),
    });
    const wait = await this.rpc<AgentWaitResult>("agent.wait", { runId: accepted.runId });
    if (wait.status === "pending") {
      throw new OpenClawGatewayUnavailableError("openclaw_gateway_unavailable: agent.wait returned pending");
    }
    if (wait.status === "error") {
      throw new Error(wait.error || "agent_error");
    }
    return restoreTurn(wait);
  }

  close(): void {
    this.failAll(new OpenClawGatewayUnavailableError("openclaw_gateway_unavailable: client closed"));
    this.ws.close();
  }

  private takeRes(frame: Extract<GatewayFrame, { type: "res" }>): void {
    const pending = this.pending.get(frame.id);
    if (!pending) {
      return;
    }
    this.pending.delete(frame.id);
    if (frame.ok) {
      pending.resolve(frame.payload);
    } else {
      pending.reject(new Error(`${frame.error.code}: ${frame.error.message}`));
    }
  }

  private failAll(err: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(err);
    }
    this.pending.clear();
  }
}

function frameRaw(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof Buffer) {
    return data.toString("utf8");
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
  }
  return String(data);
}

function waitChallenge(
  box: { nonce?: string; ts?: number; waiters: Array<() => void> },
  timeoutMs: number,
): Promise<{ nonce: string; ts: number }> {
  if (typeof box.nonce === "string" && typeof box.ts === "number") {
    return Promise.resolve({ nonce: box.nonce, ts: box.ts });
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new OpenClawGatewayUnavailableError("openclaw_gateway_unavailable: connect.challenge timeout"));
    }, timeoutMs);
    box.waiters.push(() => {
      clearTimeout(timer);
      if (typeof box.nonce === "string" && typeof box.ts === "number") {
        resolve({ nonce: box.nonce, ts: box.ts });
      } else {
        reject(new OpenClawGatewayUnavailableError("openclaw_gateway_unavailable: invalid connect.challenge"));
      }
    });
  });
}

function waitRes(ws: NodeWebSocket, id: string, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new OpenClawGatewayUnavailableError("openclaw_gateway_unavailable: connect response timeout"));
    }, timeoutMs);
    const onMessage = (data: unknown) => {
      let frame: GatewayFrame;
      try {
        frame = parseFrame(frameRaw(data));
      } catch {
        return;
      }
      if (frame.type !== "res" || frame.id !== id) {
        return;
      }
      clearTimeout(timer);
      ws.off("message", onMessage);
      if (frame.ok) {
        resolve(frame.payload);
      } else {
        reject(new OpenClawGatewayUnavailableError(`${frame.error.code}: ${frame.error.message}`));
      }
    };
    ws.on("message", onMessage);
  });
}

function restoreTurn(wait: AgentWaitResult): AgentWaitResult {
  const result = wait.result;
  if (!result) {
    return wait;
  }
  const loaded = result.loaded_skill as LoadedSkill | null;
  return {
    ...wait,
    result: {
      routed_skill: result.routed_skill,
      loaded_skill: loaded,
      status: result.status,
      notes: result.notes,
      parsed: result.parsed,
    },
  };
}
