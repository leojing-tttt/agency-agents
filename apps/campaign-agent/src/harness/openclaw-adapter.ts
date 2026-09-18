import type { LoadedSkill, SkillSummary } from "./skill-loader.ts";
import type { McpToolRef } from "./mcp-whitelist.ts";
import type { IsolatedRuntime } from "./tenant-runtime.ts";

/**
 * OpenClaw-shaped harness contract.
 *
 * Maps onto real OpenClaw (https://docs.openclaw.ai/tools/skills):
 * - createSession ≈ skill snapshot at session start + getOrCreateSessionMcpRuntime
 * - skillCatalog ≈ agents.entries.*.skills allowlist, name+description only
 * - activateSkill ≈ progressive disclosure of SKILL.md body and bundled files
 * - mcpTools ≈ session MCP catalog after per-agent whitelist
 * - turn ≈ one session loop step (route skill → allowed MCP → emit messages)
 *
 * This slice does not embed the OpenClaw Gateway process.
 * It does not ship Control UI, WhatsApp/channel adapters, Skill Workshop,
 * or Hermes-style self-writing memory.
 */
export type SessionTurnInput = {
  text?: string;
  attachment?: {
    filename: string;
    bytes: Uint8Array;
  };
};

export type SessionTurnResult = {
  routed_skill: string | null;
  loaded_skill: LoadedSkill | null;
  status: "completed" | "blocked" | "ignored";
  notes: string[];
};

export interface OpenClawSession {
  readonly sessionId: string;
  readonly tenantId: string;
  readonly agentId: string;
  readonly agentConfigVersion: string;
  skillCatalog(): SkillSummary[];
  activateSkill(name: string): Promise<LoadedSkill>;
  mcpTools(): readonly McpToolRef[];
  turn(input: SessionTurnInput): Promise<SessionTurnResult>;
  close(): Promise<void>;
}

export interface OpenClawHarnessAdapter {
  readonly kind: "local-loop" | "openclaw-gateway";
  createSession(runtime: IsolatedRuntime, campaignId: string): Promise<OpenClawSession>;
}

/**
 * Gateway adapter is an explicit seam, not a fake passing implementation.
 * Slice 1 runs the local loop. Wiring a real per-tenant OpenClaw Gateway comes later.
 */
export class OpenClawGatewayAdapter implements OpenClawHarnessAdapter {
  readonly kind = "openclaw-gateway" as const;

  async createSession(_runtime: IsolatedRuntime, _campaignId: string): Promise<OpenClawSession> {
    throw new Error(
      "openclaw_gateway_not_embedded: this slice uses LocalLoopAdapter. " +
        "A real Gateway would snapshot skills per session and open getOrCreateSessionMcpRuntime " +
        "with that tenant's workspace only — never a shared Control UI or WhatsApp channel.",
    );
  }
}
