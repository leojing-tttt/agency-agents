import { CampaignCore } from "../campaign-core/index.ts";
import type { LoadedSkill, SkillSummary } from "./skill-loader.ts";
import { SkillLibrary } from "./skill-loader.ts";
import { advertisedMcpTools, type McpToolRef } from "./mcp-whitelist.ts";
import type {
  OpenClawHarnessAdapter,
  OpenClawSession,
  SessionTurnInput,
  SessionTurnResult,
} from "./openclaw-adapter.ts";
import { newId } from "../campaign-core/ids.ts";
import { routeSkillTurn, runParseBriefScript } from "./skill-turn.ts";
import type { IsolatedRuntime } from "./tenant-runtime.ts";

export { runParseBriefScript };

/**
 * In-process skill engine. The product drop-Brief path uses OpenClawGatewayAdapter.
 * Kept so the Gateway process and unit tests share the same router/script runner.
 */
export class LocalLoopAdapter implements OpenClawHarnessAdapter {
  readonly kind = "local-loop" as const;

  constructor(private readonly core: CampaignCore) {}

  async createSession(runtime: IsolatedRuntime, campaignId: string): Promise<OpenClawSession> {
    const library = new SkillLibrary(runtime.skillsRoot);
    const catalog = await library.catalog(runtime.agent.skills);
    const mcp = advertisedMcpTools(runtime.tenant.mcp_servers, runtime.agent);
    return new LocalLoopSession({
      core: this.core,
      runtime,
      campaignId,
      library,
      catalog,
      mcp,
    });
  }
}

class LocalLoopSession implements OpenClawSession {
  readonly sessionId: string;
  readonly tenantId: string;
  readonly agentId: string;
  readonly agentConfigVersion: string;
  private closed = false;

  constructor(
    private readonly ctx: {
      core: CampaignCore;
      runtime: IsolatedRuntime;
      campaignId: string;
      library: SkillLibrary;
      catalog: SkillSummary[];
      mcp: McpToolRef[];
    },
  ) {
    this.sessionId = newId("ses");
    this.tenantId = ctx.runtime.tenant.tenant_id;
    this.agentId = ctx.runtime.agent.agent_id;
    this.agentConfigVersion = ctx.runtime.agent.version;
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
    return this.ctx.library.activate(name, this.ctx.runtime.agent.skills);
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
    const result = await routeSkillTurn({
      catalog: this.ctx.catalog,
      activateSkill: (name) => this.activateSkill(name),
      turn: input,
    });
    if (result.routed_skill === "brief-parse" && result.parsed) {
      this.ctx.core.recordBrief({
        tenant_id: this.tenantId,
        campaign_id: this.ctx.campaignId,
        payload: result.parsed.payload,
        citations: result.parsed.citations,
      });
    }
    return {
      routed_skill: result.routed_skill,
      loaded_skill: result.loaded_skill,
      status: result.status,
      notes: result.notes,
    };
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  private ensureOpen(): void {
    if (this.closed) {
      throw new Error("session_closed");
    }
  }
}
