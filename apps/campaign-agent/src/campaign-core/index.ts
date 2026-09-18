import { ArtifactStore } from "./artifacts.ts";
import { briefGateState, openQuestionsForBrief } from "./brief.ts";
import {
  assertContentPackAllowed,
  CONTENT_WAIT_MESSAGE,
  projectContentSurface,
} from "./gates.ts";
import { newId, nowIso } from "./ids.ts";
import { CampaignMemoryIndex } from "./memory.ts";
import type {
  Artifact,
  BriefArtifact,
  BriefPayload,
  Campaign,
  Citation,
  ContentPackPayload,
  ContentSurface,
  TalentRowLock,
  ThreadMessage,
} from "./types.ts";

export class TenantIsolationError extends Error {
  constructor(message = "tenant_isolation") {
    super(message);
    this.name = "TenantIsolationError";
  }
}

/**
 * campaign-core: objects, versions, memory pins, gates.
 * Agents have no write permission on the campaign status machine.
 */
export class CampaignCore {
  readonly artifacts = new ArtifactStore();
  readonly memory = new CampaignMemoryIndex();
  private readonly campaigns = new Map<string, Campaign>();
  private readonly threads = new Map<string, ThreadMessage[]>();
  private readonly talentRows = new Map<string, TalentRowLock[]>();

  createCampaign(input: {
    tenant_id: string;
    name: string;
    nodes?: Campaign["nodes"];
  }): Campaign {
    const campaign: Campaign = {
      campaign_id: newId("cmp"),
      tenant_id: input.tenant_id,
      name: input.name,
      status: "draft",
      created_at: nowIso(),
      nodes: input.nodes ?? { plan: true, talent: true, content: true },
    };
    this.campaigns.set(campaign.campaign_id, campaign);
    this.threads.set(campaign.campaign_id, []);
    this.talentRows.set(campaign.campaign_id, []);
    this.appendMessage({
      campaign_id: campaign.campaign_id,
      tenant_id: campaign.tenant_id,
      role: "agent",
      agent_name: "plan",
      kind: "text",
      text: "把这场的客户 Brief 丢给我。我按代理作业往下做：主张冻结 → 锁提报名单 → 再写内容卡。不是通用聊天。",
    });
    if (campaign.nodes.content) {
      this.appendMessage({
        campaign_id: campaign.campaign_id,
        tenant_id: campaign.tenant_id,
        role: "agent",
        agent_name: "content",
        kind: "wait",
        text: CONTENT_WAIT_MESSAGE,
      });
    }
    return campaign;
  }

  getCampaign(tenantId: string, campaignId: string): Campaign {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`campaign_not_found: ${campaignId}`);
    }
    if (campaign.tenant_id !== tenantId) {
      throw new TenantIsolationError();
    }
    return campaign;
  }

  listCampaigns(tenantId: string): Campaign[] {
    return [...this.campaigns.values()].filter((item) => item.tenant_id === tenantId);
  }

  recordBrief(input: {
    tenant_id: string;
    campaign_id: string;
    object_id?: string;
    payload: BriefPayload;
    citations: Citation[];
  }): { brief: BriefArtifact; message: ThreadMessage } {
    const campaign = this.getCampaign(input.tenant_id, input.campaign_id);
    const questions = openQuestionsForBrief(input.payload);
    const existingPin = this.memory.activePin(input.tenant_id, campaign.campaign_id, "parsed_brief");
    const objectId = input.object_id ?? existingPin?.object_id ?? newId("brief");
    const brief = this.artifacts.append<BriefPayload>({
      object_id: objectId,
      type: "Brief",
      tenant_id: campaign.tenant_id,
      campaign_id: campaign.campaign_id,
      gate_state: briefGateState(questions),
      payload: input.payload,
      open_questions: questions,
      citations: input.citations,
      created_by: "agent",
    }) as BriefArtifact;

    this.memory.pin({
      tenant_id: campaign.tenant_id,
      campaign_id: campaign.campaign_id,
      kind: "parsed_brief",
      object_type: "Brief",
      object_id: brief.object_id,
      object_version: brief.version,
      note: questions.length ? "parsed_with_open_questions" : "parsed_complete",
    });

    const card = this.appendMessage({
      campaign_id: campaign.campaign_id,
      tenant_id: campaign.tenant_id,
      role: "agent",
      agent_name: "brief_parse",
      kind: questions.length ? "open_questions" : "artifact_card",
      text: projectBriefCardText(brief),
      artifact_ref: {
        object_id: brief.object_id,
        version: brief.version,
        version_id: brief.version_id,
      },
    });
    return { brief, message: card };
  }

  /**
   * Resolve the pinned Brief version. Downstream must use this, not the latest draft
   * and not the wording sitting in the thread.
   */
  resolvePinnedBrief(tenantId: string, campaignId: string): BriefArtifact | undefined {
    const pin = this.memory.activePin(tenantId, campaignId, "parsed_brief")
      ?? this.memory.activePin(tenantId, campaignId, "confirmed_brief");
    if (!pin) {
      return undefined;
    }
    return this.artifacts.getVersion<BriefArtifact["payload"]>(
      tenantId,
      pin.object_id,
      pin.object_version,
    ) as BriefArtifact;
  }

  appendUserMessage(tenantId: string, campaignId: string, text: string): ThreadMessage {
    this.getCampaign(tenantId, campaignId);
    return this.appendMessage({
      campaign_id: campaignId,
      tenant_id: tenantId,
      role: "user",
      kind: "text",
      text,
    });
  }

  thread(tenantId: string, campaignId: string): ThreadMessage[] {
    this.getCampaign(tenantId, campaignId);
    return [...(this.threads.get(campaignId) ?? [])];
  }

  /**
   * Hydrate an artifact card from campaign-core, never from frozen chat HTML.
   */
  hydrateMessage(tenantId: string, message: ThreadMessage): ThreadMessage {
    if (!message.artifact_ref) {
      return message;
    }
    const artifact = this.artifacts.getVersion(
      tenantId,
      message.artifact_ref.object_id,
      message.artifact_ref.version,
    );
    if (artifact.type === "Brief") {
      return { ...message, text: projectBriefCardText(artifact as BriefArtifact) };
    }
    return message;
  }

  lockTalentRow(input: {
    tenant_id: string;
    campaign_id: string;
    row: Omit<TalentRowLock, "lock_state"> & { lock_state?: "locked" };
  }): TalentRowLock {
    this.getCampaign(input.tenant_id, input.campaign_id);
    const row: TalentRowLock = { ...input.row, lock_state: "locked" };
    const rows = this.talentRows.get(input.campaign_id) ?? [];
    const next = rows.filter((item) => item.row_id !== row.row_id);
    next.push(row);
    this.talentRows.set(input.campaign_id, next);
    this.memory.pin({
      tenant_id: input.tenant_id,
      campaign_id: input.campaign_id,
      kind: "locked_row",
      object_type: "TalentShortlist",
      object_id: row.artifact_id ?? row.row_id,
      object_version: row.artifact_version ?? 1,
      note: `${row.talent_name} ${row.platform} ${row.placement}`,
    });
    return row;
  }

  upsertUnlockedRow(tenantId: string, campaignId: string, row: TalentRowLock): void {
    this.getCampaign(tenantId, campaignId);
    const rows = this.talentRows.get(campaignId) ?? [];
    const next = rows.filter((item) => item.row_id !== row.row_id);
    next.push({ ...row, lock_state: row.lock_state ?? "unlocked" });
    this.talentRows.set(campaignId, next);
  }

  talentRowList(tenantId: string, campaignId: string): TalentRowLock[] {
    this.getCampaign(tenantId, campaignId);
    return [...(this.talentRows.get(campaignId) ?? [])];
  }

  createContentPack(input: {
    tenant_id: string;
    campaign_id: string;
    locked_row_id: string;
    script?: string;
  }): Artifact<ContentPackPayload> {
    const rows = this.talentRowList(input.tenant_id, input.campaign_id);
    const row = assertContentPackAllowed(rows, input.locked_row_id);
    const pack = this.artifacts.append<ContentPackPayload>({
      object_id: newId("pack"),
      type: "ContentPack",
      tenant_id: input.tenant_id,
      campaign_id: input.campaign_id,
      gate_state: "drafting",
      payload: {
        talent_name: row.talent_name,
        platform: row.platform,
        placement: row.placement,
        locked_row_id: row.row_id,
        script: input.script,
      },
      open_questions: [],
      citations: [],
      created_by: "agent",
    });
    this.appendMessage({
      campaign_id: input.campaign_id,
      tenant_id: input.tenant_id,
      role: "agent",
      agent_name: "content",
      kind: "artifact_card",
      text: `脚本卡 · ${row.talent_name} · ${row.platform}${row.placement}`,
      artifact_ref: {
        object_id: pack.object_id,
        version: pack.version,
        version_id: pack.version_id,
      },
    });
    return pack;
  }

  contentSurface(tenantId: string, campaignId: string): ContentSurface {
    const rows = this.talentRowList(tenantId, campaignId);
    const cards = this.artifacts
      .listForCampaign(tenantId, campaignId)
      .filter((item) => item.type === "ContentPack") as Artifact<ContentPackPayload>[];
    return projectContentSurface({ rows, cards });
  }

  snapshot(tenantId: string, campaignId: string) {
    const campaign = this.getCampaign(tenantId, campaignId);
    const thread = this.thread(tenantId, campaignId).map((msg) => this.hydrateMessage(tenantId, msg));
    return {
      campaign,
      thread,
      memory: this.memory.list(tenantId, campaignId),
      pinned_brief: this.resolvePinnedBrief(tenantId, campaignId) ?? null,
      content: this.contentSurface(tenantId, campaignId),
      artifacts: this.artifacts.listForCampaign(tenantId, campaignId),
    };
  }

  private appendMessage(input: Omit<ThreadMessage, "id" | "created_at"> & { tenant_id: string }): ThreadMessage {
    this.getCampaign(input.tenant_id, input.campaign_id);
    const message: ThreadMessage = {
      id: newId("msg"),
      campaign_id: input.campaign_id,
      role: input.role,
      agent_name: input.agent_name,
      kind: input.kind,
      text: input.text,
      artifact_ref: input.artifact_ref,
      created_at: nowIso(),
    };
    const list = this.threads.get(input.campaign_id) ?? [];
    list.push(message);
    this.threads.set(input.campaign_id, list);
    return message;
  }
}

export function projectBriefCardText(brief: BriefArtifact): string {
  const p = brief.payload;
  const kpi = p.kpis.length ? p.kpis.join(" / ") : "未给出（不编造）";
  const budget = p.budget_band
    ? [
        p.budget_band.talent_fee !== undefined ? `达人费 ${p.budget_band.talent_fee}` : null,
        p.budget_band.production !== undefined ? `制作 ${p.budget_band.production}` : null,
        p.budget_band.period_weeks !== undefined ? `周期 ${p.budget_band.period_weeks} 周` : null,
        p.budget_band.raw ? `原文 ${p.budget_band.raw}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "未给出（不编造）";
  const questions = brief.open_questions
    .map((q) => `缺项 · ${q.field}：${q.question}`)
    .join("\n");
  return [
    `已结构化 Brief ${brief.version_id}（产物版本 ${brief.version}）。线程只是这张卡片，不是真相。`,
    `目标：${p.objective ?? "未给出"} · KPI：${kpi} · 预算：${budget}`,
    p.platforms_include.length ? `平台：${p.platforms_include.join("、")}` : null,
    p.platforms_exclude.length ? `不做：${p.platforms_exclude.join("、")}` : null,
    questions || null,
  ]
    .filter(Boolean)
    .join("\n");
}
