import { randomBytes } from "node:crypto";

/** Documented OpenClaw Gateway wire version (docs.openclaw.ai/gateway/clients). */
export const OPENCLAW_PROTOCOL = 4;

export type GatewayFrame =
  | { type: "req"; id: string; method: string; params?: Record<string, unknown> }
  | { type: "res"; id: string; ok: true; payload: unknown }
  | { type: "res"; id: string; ok: false; error: { code: string; message: string; details?: unknown } }
  | { type: "event"; event: string; payload: unknown };

export type ConnectChallenge = { nonce: string; ts: number };

export function newChallenge(): ConnectChallenge {
  return { nonce: randomBytes(16).toString("hex"), ts: Date.now() };
}

export function parseFrame(raw: string): GatewayFrame {
  const value = JSON.parse(raw) as GatewayFrame;
  if (!value || typeof value !== "object" || !("type" in value)) {
    throw new Error("invalid_gateway_frame");
  }
  return value;
}

export function reqFrame(id: string, method: string, params?: Record<string, unknown>): string {
  return JSON.stringify({ type: "req", id, method, params: params ?? {} });
}

export function resOk(id: string, payload: unknown): string {
  return JSON.stringify({ type: "res", id, ok: true, payload });
}

export function resErr(id: string, code: string, message: string, details?: unknown): string {
  return JSON.stringify({
    type: "res",
    id,
    ok: false,
    error: details === undefined ? { code, message } : { code, message, details },
  });
}

export function eventFrame(event: string, payload: unknown): string {
  return JSON.stringify({ type: "event", event, payload });
}
