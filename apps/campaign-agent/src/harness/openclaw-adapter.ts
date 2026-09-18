import { CampaignCore } from "../campaign-core/index.ts";
import type { LoadedSkill, SkillSummary } from "./skill-loader.ts";
import { SkillLibrary, SkillLoadError } from "./skill-loader.ts";
import { advertisedMcpTools, type McpToolRef } from "./mcp-whitelist.ts";
import type { IsolatedRuntime } from "./tenant-runtime.ts";
import { OpenClawGatewayClient, OpenClawGatewayUnavailableError } from "./openclaw-client.ts";
import { OpenClawSupervisor } from "./openclaw-supervisor.ts";
import { newId } from "../campaign-core/ids.ts";
import {
  chainPlanProposalAfterBrief,
  commitSkillResult,
  pinnedBriefInput,
  type SkillTurnResult,
} from "./skill-turn.ts";

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
 * Product UI never mounts OpenClaw Control UI, WhatsApp/channel adapters,
 * Skill Workshop, or Hermes-style self-writing memory.
 */
export type SessionTurnInput = {
  text?: string;
  attachment?: {
    filename: string;
    bytes: Uint8Array;
  };
  pinned_brief?: {
    version_id: string;
    object_id: string;
    version: number;
    payload: import("../campaign-core/types.ts").BriefPayload;
    open_questions: import("../campaign-core/types.ts").OpenQuestion[];
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

export type OpenClawGatewayAdapterOptions = {
  core: CampaignCore;
  supervisor?: OpenClawSupervisor;
  /** When false, never spawn. Connect to `url` or fail. Tests use this to prove missing runtime fails. */
  spawn?: boolean;
  url?: string;
  token?: string;
};

/**
 * Talks to a live OpenClaw-compatible Gateway over the documented WebSocket
 * protocol. Drop-Brief is an `agent` + `agent.wait` turn, not an in-process shortcut.
 * Missing runtime is an error — never a fake success.
 */
export class OpenClawGatewayAdapter implements OpenClawHarnessAdapter {
  readonly kind = "openclaw-gateway" as const;
  private readonly core: CampaignCore;
  readonly supervisor: OpenClawSupervisor;
  private readonly spawn: boolean;
  private readonly url?: string;
  private readonly token?: string;

  constructor(options: OpenClawGatewayAdapterOptions) {
    this.core = options.core;
    this.supervisor = options.supervisor ?? new OpenClawSupervisor();
    this.spawn = options.spawn !== false;
    this.url = options.url;
    this.token = options.token;
  }

  async createSession(runtime: IsolatedRuntime, campaignId: string): Promise<OpenClawSession> {
    const endpoint = await this.resolveEndpoint(runtime);
    const client = await OpenClawGatewayClient.connect({
      url: endpoint.url,
      token: endpoint.token,
    });
    try {
      const sessionKey = `tenant:${runtime.tenant.tenant_id}:campaign:${campaignId}:agent:${runtime.agent.agent_id}`;
      const created = await client.sessionsCreate(runtime.agent.agent_id, sessionKey);
      const skills = await client.skillsStatus(runtime.agent.agent_id);
      const tools = await client.toolsEffective(created.sessionKey, runtime.agent.agent_id);
      const mcp = advertisedMcpTools(runtime.tenant.mcp_servers, runtime.agent);
      const advertised = tools.groups.flatMap((group) => group.tools.map((tool) => tool.id));
      const filtered = mcp.filter((tool) => advertised.includes(tool.handle));
      return new GatewayBackedSession({
        core: this.core,
        client,
        runtime,
        campaignId,
        sessionId: created.sessionId,
        sessionKey: created.sessionKey,
        catalog: skills.skills.map(({ name, description, version, dir }) => ({
          name,
          description,
          version,
          dir,
        })),
        mcp: filtered,
      });
    } catch (err) {
      client.close();
      throw err;
    }
  }

  async stop(): Promise<void> {
    await this.supervisor.stopAll();
  }

  private async resolveEndpoint(runtime: IsolatedRuntime): Promise<{ url: string; token: string }> {
    if (!this.spawn) {
      if (!this.url || !this.token) {
        throw new OpenClawGatewayUnavailableError(
          "openclaw_gateway_unavailable: no Gateway URL/token and spawn disabled",
        );
      }
      return { url: this.url, token: this.token };
    }
    if (this.url && this.token) {
      return { url: this.url, token: this.token };
    }
    const supervised = await this.supervisor.ensure({
      tenant: runtime.tenant,
      skillsRoot: runtime.skillsRoot,
    });
    return { url: supervised.url, token: supervised.token };
  }
}

class GatewayBackedSession implements OpenClawSession {
  readonly sessionId: string;
  readonly tenantId: string;
  readonly agentId: string;
  readonly agentConfigVersion: string;
  private closed = false;
  private readonly library: SkillLibrary;

  constructor(
    private readonly ctx: {
      core: CampaignCore;
      client: OpenClawGatewayClient;
      runtime: IsolatedRuntime;
      campaignId: string;
      sessionId: string;
      sessionKey: string;
      catalog: SkillSummary[];
      mcp: McpToolRef[];
    },
  ) {
    this.sessionId = ctx.sessionId || newId("ses");
    this.tenantId = ctx.runtime.tenant.tenant_id;
    this.agentId = ctx.runtime.agent.agent_id;
    this.agentConfigVersion = ctx.runtime.agent.version;
    this.library = new SkillLibrary(ctx.runtime.skillsRoot);
  }

  skillCatalog(): SkillSummary[] {
    this.ensureOpen();
    return this.ctx.catalog.map(({ name, description, version, dir }) => ({
      name,
      description,
      version,
      dir,
    }));
  }

  async activateSkill(name: string): Promise<LoadedSkill> {
    this.ensureOpen();
    const allowed = this.ctx.catalog.some((item) => item.name === name);
    if (!allowed) {
      throw new SkillLoadError(`skill_not_allowed_or_missing: ${name}`);
    }
    const live = await this.ctx.client.skillsStatus(this.agentId);
    if (!live.skills.some((item) => item.name === name)) {
      throw new SkillLoadError(`skill_not_allowed_or_missing: ${name}`);
    }
    return this.library.activate(name, this.ctx.runtime.agent.skills);
  }

  mcpTools(): readonly McpToolRef[] {
    this.ensureOpen();
    return this.ctx.mcp;
  }

  async turn(input: SessionTurnInput): Promise<SessionTurnResult> {
    this.ensureOpen();
    if (input.text) {
      this.ctx.core.appendUserMessage(this.tenantId, this.ctx.campaignId, input.text);
    }
    if (input.attachment) {
      this.ctx.core.appendUserMessage(
        this.tenantId,
        this.ctx.campaignId,
        `文件 ${input.attachment.filename}`,
      );
    }
    const result = await this.runGatewayTurn(input);
    if (!result) {
      return { routed_skill: null, loaded_skill: null, status: "ignored", notes: [] };
    }
    commitSkillResult(this.ctx.core, this.tenantId, this.ctx.campaignId, result);
    const chained = await chainPlanProposalAfterBrief({
      catalog: this.ctx.catalog,
      briefResult: result,
      pinnedBrief: pinnedBriefInput(this.ctx.core, this.tenantId, this.ctx.campaignId),
      runTurn: async (next) => {
        const inner = await this.runGatewayTurn(next);
        if (!inner) {
          return { routed_skill: null, loaded_skill: null, status: "ignored" as const, notes: ["gateway_empty_plan_turn"] };
        }
        return inner;
      },
    });
    if (chained) {
      commitSkillResult(this.ctx.core, this.tenantId, this.ctx.campaignId, chained);
      result.notes = [...result.notes, "chained_plan-proposal"];
    }
    return {
      routed_skill: result.routed_skill,
      loaded_skill: result.loaded_skill,
      status: result.status,
      notes: result.notes,
    };
  }

  private async runGatewayTurn(input: SessionTurnInput): Promise<SkillTurnResult | null> {
    const wait = await this.ctx.client.agentTurn({
      agentId: this.agentId,
      sessionKey: this.ctx.sessionKey,
      message: input.text,
      attachment: input.attachment,
      pinnedBrief: input.pinned_brief ?? pinnedBriefInput(this.ctx.core, this.tenantId, this.ctx.campaignId),
    });
    return wait.result ?? null;
  }

  async close(): Promise<void> {
    this.closed = true;
    this.ctx.client.close();
  }

  private ensureOpen(): void {
    if (this.closed) {
      throw new Error("session_closed");
    }
  }
}
