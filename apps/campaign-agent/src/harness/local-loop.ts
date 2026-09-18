import { pathToFileURL } from "node:url";
import path from "node:path";
import { CampaignCore } from "../campaign-core/index.ts";
import type { BriefPayload, Citation } from "../campaign-core/types.ts";
import { newId } from "../campaign-core/ids.ts";
import type { LoadedSkill, SkillSummary } from "./skill-loader.ts";
import { SkillLibrary } from "./skill-loader.ts";
import { advertisedMcpTools, type McpToolRef } from "./mcp-whitelist.ts";
import type {
  OpenClawHarnessAdapter,
  OpenClawSession,
  SessionTurnInput,
  SessionTurnResult,
} from "./openclaw-adapter.ts";
import { extractSourceText, looksLikeBrief } from "./source-text.ts";
import type { IsolatedRuntime } from "./tenant-runtime.ts";

type ParseBriefModule = {
  parseBriefSource: (input: {
    text: string;
    filename?: string;
    pages?: string[];
  }) => { payload: BriefPayload; citations: Citation[] };
};

/**
 * Working local harness loop. Compatible with Agent Skills loading and the
 * OpenClaw adapter interface. Does not start an OpenClaw Gateway.
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
    const notes: string[] = [];
    if (input.text) {
      this.ctx.core.appendUserMessage(this.tenantId, this.ctx.campaignId, input.text);
    }
    if (input.attachment) {
      this.ctx.core.appendUserMessage(
        this.tenantId,
        this.ctx.campaignId,
        `文件 ${input.attachment.filename}`,
      );
      const extracted = extractSourceText(input.attachment.filename, input.attachment.bytes);
      if (!looksLikeBrief(input.attachment.filename, extracted.text) && extracted.text.trim()) {
        notes.push("attachment_not_classified_as_brief");
      }
      if (!this.hasSkill("brief-parse")) {
        notes.push("brief-parse_not_on_allowlist");
        return { routed_skill: null, loaded_skill: null, status: "ignored", notes };
      }
      const loaded = await this.activateSkill("brief-parse");
      const parsed = await runParseBriefScript(loaded, extracted, input.attachment.filename);
      this.ctx.core.recordBrief({
        tenant_id: this.tenantId,
        campaign_id: this.ctx.campaignId,
        payload: parsed.payload,
        citations: parsed.citations,
      });
      return {
        routed_skill: "brief-parse",
        loaded_skill: loaded,
        status: parsed.payload.budget_band && parsed.payload.kpis.length ? "completed" : "blocked",
        notes,
      };
    }

    if (input.text && /brief|纪要|客户要/i.test(input.text) && this.hasSkill("brief-parse")) {
      notes.push("text_without_file_is_not_a_brief_source");
    }
    return { routed_skill: null, loaded_skill: null, status: "ignored", notes };
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  private hasSkill(name: string): boolean {
    return this.ctx.catalog.some((item) => item.name === name);
  }

  private ensureOpen(): void {
    if (this.closed) {
      throw new Error("session_closed");
    }
  }
}

export async function runParseBriefScript(
  skill: LoadedSkill,
  extracted: { text: string; pages: string[] },
  filename: string,
): Promise<{ payload: BriefPayload; citations: Citation[] }> {
  const scriptRel = skill.bundled.scripts.find((item) => item.endsWith("parse-brief.mjs"));
  if (!scriptRel) {
    throw new Error("brief-parse skill is missing scripts/parse-brief.mjs");
  }
  const scriptPath = path.join(skill.dir, scriptRel);
  const mod = (await import(pathToFileURL(scriptPath).href)) as ParseBriefModule;
  return mod.parseBriefSource({
    text: extracted.text,
    filename,
    pages: extracted.pages,
  });
}
