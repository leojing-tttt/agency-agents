import { pathToFileURL } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampaignCore } from "../src/campaign-core/index.ts";
import type { BriefPayload, ProposalPayload } from "../src/campaign-core/types.ts";
import { LocalLoopAdapter } from "../src/harness/local-loop.ts";
import { OpenClawGatewayAdapter } from "../src/harness/openclaw-adapter.ts";
import { OpenClawSupervisor } from "../src/harness/openclaw-supervisor.ts";
import { SkillLibrary } from "../src/harness/skill-loader.ts";
import {
  chainPlanProposalAfterBrief,
  isBriefReadyToPlan,
} from "../src/harness/skill-turn.ts";
import { demoTenant, isolateRuntime, SKILLS_ROOT } from "../src/harness/tenant-runtime.ts";

const adapters: OpenClawGatewayAdapter[] = [];

afterEach(async () => {
  await Promise.all(adapters.splice(0).map((item) => item.stop()));
});

function liveAdapter(core: CampaignCore) {
  const adapter = new OpenClawGatewayAdapter({ core, supervisor: new OpenClawSupervisor() });
  adapters.push(adapter);
  return adapter;
}

function completeBrief(overrides: Partial<BriefPayload> = {}): BriefPayload {
  return {
    objective: "种草",
    kpis: ["抖音完播", "小红书在看"],
    budget_band: { talent_fee: 800000, production: 200000, period_weeks: 6, raw: "达人费 80 万、制作 20 万" },
    platforms_include: ["小红书", "抖音"],
    platforms_exclude: ["直播"],
    talents_must_include: ["1 个腰部医生"],
    talents_must_exclude: ["竞品飞播达人"],
    selling_points: ["屏障修护", "成分可感知"],
    ban_claims: ["第一", "医用", "疗效"],
    time_anchors: ["Q3 上市"],
    notes: null,
    ...overrides,
  };
}

function emptyProposal(overrides: Partial<ProposalPayload> = {}): ProposalPayload {
  return {
    insight: "客户要的是种草。",
    strategy_idea: "把「屏障修护」做成可感知的种草主张。",
    comm_idea: "只说 屏障修护。",
    audience: null,
    platform_play: [{ platform: "抖音", format: "短视频", role: "种草" }],
    budget_split: {
      talent_fee: 800000,
      production: 200000,
      raw: "达人费 80 万、制作 20 万",
      matches_brief_band: true,
    },
    phasing: ["Q3 上市"],
    pages: [{ title: "策略主张", purpose: "strategy_idea" }],
    sample_content_hooks: ["钩子：屏障修护（不是成稿，不拆 ContentPack）"],
    source_brief_version_id: "brief_x:v1",
    ...overrides,
  };
}

describe("plan-proposal skill bundle", () => {
  it("directory name matches SKILL.md and bundles the drafter", async () => {
    const library = new SkillLibrary(SKILLS_ROOT);
    const skill = await library.activate("plan-proposal", [
      { skill_id: "plan-proposal", version: "1.0" },
    ]);
    expect(skill.name).toBe("plan-proposal");
    expect(skill.dir.endsWith(`${path.sep}plan-proposal`)).toBe(true);
    expect(skill.description).toMatch(/Proposal|方案/);
    expect(skill.instructions).toMatch(/Don't/);
    expect(skill.instructions).toMatch(/不自动把方案写入知识库/);
    expect(skill.bundled.scripts).toContain("scripts/draft-proposal.mjs");
    const href = pathToFileURL(path.join(skill.dir, "scripts/draft-proposal.mjs")).href;
    const mod = await import(href);
    expect(typeof mod.draftProposalFromBrief).toBe("function");
  });

  it("does not invent budget or write a talent shortlist", async () => {
    const href = pathToFileURL(path.join(SKILLS_ROOT, "plan-proposal/scripts/draft-proposal.mjs")).href;
    const mod = await import(href);
    const drafted = mod.draftProposalFromBrief({
      brief: completeBrief({
        budget_band: null,
        kpis: [],
        talents_must_include: ["1 个腰部医生"],
      }),
      brief_version_id: "brief_demo:v1",
    });
    expect(drafted.payload.budget_split).toBeNull();
    expect(drafted.invented).toBe(false);
    expect(JSON.stringify(drafted.payload)).not.toMatch(/800000|刊例|林医生/);
    expect(drafted.payload.audience).toBeNull();
    expect(drafted.payload.insight).toMatch(/不锁名单/);
    expect(drafted.payload.sample_content_hooks.every((hook: string) => hook.includes("不是成稿"))).toBe(
      true,
    );
  });
});

describe("Proposal versions are append-only and pinned by version_id", () => {
  it("appends versions and keeps old bytes readable without created_at races", () => {
    const tenant = demoTenant();
    const core = new CampaignCore();
    const campaign = core.createCampaign({ tenant_id: tenant.tenant_id, name: "方案版本" });
    const brief = core.recordBrief({
      tenant_id: tenant.tenant_id,
      campaign_id: campaign.campaign_id,
      payload: completeBrief(),
      citations: [],
    });
    const first = core.recordProposal({
      tenant_id: tenant.tenant_id,
      campaign_id: campaign.campaign_id,
      payload: emptyProposal({
        strategy_idea: "主张 v1",
        source_brief_version_id: brief.brief.version_id,
      }),
      citations: [],
    });
    expect(first.proposal.version).toBe(1);
    expect(first.proposal.version_id).toBe(`${first.proposal.object_id}:v1`);
    expect(first.proposal.type).toBe("Proposal");
    expect(first.proposal.gate_state).toBe("drafting");

    const second = core.recordProposal({
      tenant_id: tenant.tenant_id,
      campaign_id: campaign.campaign_id,
      object_id: first.proposal.object_id,
      payload: emptyProposal({
        strategy_idea: "主张 v2",
        source_brief_version_id: brief.brief.version_id,
      }),
      citations: [],
    });
    expect(second.proposal.version).toBe(2);
    expect(second.proposal.version_id).toBe(`${first.proposal.object_id}:v2`);
    expect(second.proposal.supersedes_version).toBe(1);
    expect(second.proposal.version_id).not.toBe(first.proposal.version_id);

    const history = core.artifacts.history(tenant.tenant_id, first.proposal.object_id);
    expect(history.map((item) => item.version)).toEqual([1, 2]);
    expect(history.map((item) => item.version_id)).toEqual([
      `${first.proposal.object_id}:v1`,
      `${first.proposal.object_id}:v2`,
    ]);
    expect(
      core.artifacts.getVersion<ProposalPayload>(tenant.tenant_id, first.proposal.object_id, 1).payload
        .strategy_idea,
    ).toBe("主张 v1");
    expect(
      core.artifacts.getVersion<ProposalPayload>(tenant.tenant_id, first.proposal.object_id, 2).payload
        .strategy_idea,
    ).toBe("主张 v2");
  });

  it("still appends distinct version_ids when wall-clock ms does not advance", () => {
    const frozen = 1_700_000_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(frozen);
    try {
      const tenant = demoTenant();
      const core = new CampaignCore();
      const campaign = core.createCampaign({ tenant_id: tenant.tenant_id, name: "冻结时钟" });
      core.recordBrief({
        tenant_id: tenant.tenant_id,
        campaign_id: campaign.campaign_id,
        payload: completeBrief(),
        citations: [],
      });
      const first = core.recordProposal({
        tenant_id: tenant.tenant_id,
        campaign_id: campaign.campaign_id,
        payload: emptyProposal({ strategy_idea: "A" }),
        citations: [],
      });
      const second = core.recordProposal({
        tenant_id: tenant.tenant_id,
        campaign_id: campaign.campaign_id,
        object_id: first.proposal.object_id,
        payload: emptyProposal({ strategy_idea: "B" }),
        citations: [],
      });
      expect(first.proposal.version_id).toBe(`${first.proposal.object_id}:v1`);
      expect(second.proposal.version_id).toBe(`${first.proposal.object_id}:v2`);
      expect(core.memory.activePin(tenant.tenant_id, campaign.campaign_id, "drafted_proposal")?.version_id).toBe(
        second.proposal.version_id,
      );
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("pins drafted_proposal to a version; thread cards hydrate from campaign-core; no KB write", () => {
    const tenant = demoTenant();
    const core = new CampaignCore();
    const campaign = core.createCampaign({ tenant_id: tenant.tenant_id, name: "记忆钉" });
    const brief = core.recordBrief({
      tenant_id: tenant.tenant_id,
      campaign_id: campaign.campaign_id,
      payload: completeBrief(),
      citations: [],
    });
    const first = core.recordProposal({
      tenant_id: tenant.tenant_id,
      campaign_id: campaign.campaign_id,
      payload: emptyProposal({
        strategy_idea: "旧主张",
        source_brief_version_id: brief.brief.version_id,
      }),
      citations: [],
    });
    core.recordProposal({
      tenant_id: tenant.tenant_id,
      campaign_id: campaign.campaign_id,
      object_id: first.proposal.object_id,
      payload: emptyProposal({
        strategy_idea: "新主张",
        source_brief_version_id: brief.brief.version_id,
      }),
      citations: [],
    });

    const pin = core.memory.activePin(tenant.tenant_id, campaign.campaign_id, "drafted_proposal");
    expect(pin?.object_type).toBe("Proposal");
    expect(pin?.version_id).toBe(`${first.proposal.object_id}:v2`);
    expect(core.memory.activePin(tenant.tenant_id, campaign.campaign_id, "frozen_strategy")).toBeUndefined();

    const pinned = core.resolvePinnedProposal(tenant.tenant_id, campaign.campaign_id);
    expect(pinned?.payload.strategy_idea).toBe("新主张");
    expect(pinned?.payload.source_brief_version_id).toBe(brief.brief.version_id);

    const cards = core
      .thread(tenant.tenant_id, campaign.campaign_id)
      .filter((msg) => msg.agent_name === "plan" && msg.artifact_ref);
    expect(cards[0]?.artifact_ref?.version_id).toBe(`${first.proposal.object_id}:v1`);
    const hydratedOld = core.hydrateMessage(tenant.tenant_id, cards[0]!);
    expect(hydratedOld.text).toContain("旧主张");
    expect(hydratedOld.text).not.toContain("新主张");

    const snap = core.snapshot(tenant.tenant_id, campaign.campaign_id);
    expect(JSON.stringify(snap)).not.toMatch(/kb_write|kb_ingest|collection_ingest/);
    expect(snap.memory.every((item) => item.version_id.includes(":v"))).toBe(true);
    expect(snap.content.kind).toBe("wait_message");
    expect(snap.content.cards).toEqual([]);
  });

  it("blocks when strategy_idea is missing and does not freeze", () => {
    const tenant = demoTenant();
    const core = new CampaignCore();
    const campaign = core.createCampaign({ tenant_id: tenant.tenant_id, name: "空转" });
    core.recordBrief({
      tenant_id: tenant.tenant_id,
      campaign_id: campaign.campaign_id,
      payload: completeBrief({ objective: null, selling_points: [] }),
      citations: [],
    });
    const recorded = core.recordProposal({
      tenant_id: tenant.tenant_id,
      campaign_id: campaign.campaign_id,
      payload: emptyProposal({ strategy_idea: null }),
      citations: [],
    });
    expect(recorded.proposal.gate_state).toBe("blocked");
    expect(recorded.proposal.open_questions.some((q) => q.field === "strategy_idea" && q.blocking)).toBe(
      true,
    );
    expect(core.memory.activePin(tenant.tenant_id, campaign.campaign_id, "frozen_strategy")).toBeUndefined();
  });
});

describe("local conversational loop Brief → Proposal", () => {
  it("one campaign thread: drop complete Brief then auto-chain plan-proposal", async () => {
    const tenant = demoTenant();
    const core = new CampaignCore();
    const campaign = core.createCampaign({ tenant_id: tenant.tenant_id, name: "本场" });
    const session = await new LocalLoopAdapter(core).createSession(
      isolateRuntime(tenant, "beauty-essence-campaign", SKILLS_ROOT),
      campaign.campaign_id,
    );
    const turn = await session.turn({
      attachment: {
        filename: "客户Brief.txt",
        bytes: Buffer.from(
          "目标：种草\nKPI：抖音完播\n预算：达人费 80 万、制作 20 万、周期 6 周\n平台：小红书+抖音\n卖点：屏障修护\n禁用：疗效\n",
          "utf8",
        ),
      },
    });
    expect(turn.routed_skill).toBe("brief-parse");
    expect(turn.notes).toContain("chained_plan-proposal");
    const brief = core.resolvePinnedBrief(tenant.tenant_id, campaign.campaign_id);
    const proposal = core.resolvePinnedProposal(tenant.tenant_id, campaign.campaign_id);
    expect(brief?.version_id).toMatch(/:v1$/);
    expect(proposal?.version_id).toMatch(/:v1$/);
    expect(proposal?.payload.source_brief_version_id).toBe(brief?.version_id);
    expect(proposal?.payload.strategy_idea).toBeTruthy();
    expect(proposal?.payload.budget_split?.talent_fee).toBe(800000);
    expect(proposal?.payload.budget_split?.matches_brief_band).toBe(true);
    expect(core.memory.activePin(tenant.tenant_id, campaign.campaign_id, "parsed_brief")?.version_id).toBe(
      brief?.version_id,
    );
    expect(core.memory.activePin(tenant.tenant_id, campaign.campaign_id, "drafted_proposal")?.version_id).toBe(
      proposal?.version_id,
    );
    expect(core.contentSurface(tenant.tenant_id, campaign.campaign_id).kind).toBe("wait_message");
    await session.close();
  });

  it("raw-only budget band plus KPI does not auto-plan; 出方案 still drafts with open_questions", async () => {
    const tenant = demoTenant();
    const core = new CampaignCore();
    const campaign = core.createCampaign({ tenant_id: tenant.tenant_id, name: "预算待定" });
    const session = await new LocalLoopAdapter(core).createSession(
      isolateRuntime(tenant, "beauty-essence-campaign", SKILLS_ROOT),
      campaign.campaign_id,
    );
    const briefTurn = await session.turn({
      attachment: {
        filename: "待定.txt",
        bytes: Buffer.from("目标：种草\nKPI：抖音完播\n预算：待定\n卖点：屏障修护\n", "utf8"),
      },
    });
    expect(briefTurn.routed_skill).toBe("brief-parse");
    expect(briefTurn.status).toBe("blocked");
    expect(briefTurn.notes).not.toContain("chained_plan-proposal");
    const brief = core.resolvePinnedBrief(tenant.tenant_id, campaign.campaign_id);
    expect(brief?.gate_state).toBe("blocked");
    expect(brief?.payload.kpis).toEqual(["抖音完播"]);
    expect(brief?.payload.budget_band).toMatchObject({ raw: expect.stringContaining("待定") });
    expect(brief?.payload.budget_band?.talent_fee).toBeUndefined();
    expect(brief?.payload.budget_band?.production).toBeUndefined();
    expect(core.resolvePinnedProposal(tenant.tenant_id, campaign.campaign_id)).toBeUndefined();

    const planTurn = await session.turn({ text: "出方案" });
    expect(planTurn.routed_skill).toBe("plan-proposal");
    const proposal = core.resolvePinnedProposal(tenant.tenant_id, campaign.campaign_id);
    expect(proposal?.gate_state).toBe("blocked");
    expect(proposal?.open_questions.some((q) => q.field === "budget_split" && q.blocking)).toBe(true);
    expect(JSON.stringify(proposal?.payload)).not.toMatch(/800000/);
    await session.close();
  });

  it("blocked Brief does not auto-plan; 出方案 still drafts with open_questions and no invented amounts", async () => {
    const tenant = demoTenant();
    const core = new CampaignCore();
    const campaign = core.createCampaign({ tenant_id: tenant.tenant_id, name: "缺预算" });
    const session = await new LocalLoopAdapter(core).createSession(
      isolateRuntime(tenant, "beauty-essence-campaign", SKILLS_ROOT),
      campaign.campaign_id,
    );
    const briefTurn = await session.turn({
      attachment: {
        filename: "缺项.txt",
        bytes: Buffer.from("目标：种草\n卖点：屏障修护\n", "utf8"),
      },
    });
    expect(briefTurn.routed_skill).toBe("brief-parse");
    expect(briefTurn.status).toBe("blocked");
    expect(briefTurn.notes).not.toContain("chained_plan-proposal");
    expect(core.resolvePinnedProposal(tenant.tenant_id, campaign.campaign_id)).toBeUndefined();

    const planTurn = await session.turn({ text: "出方案" });
    expect(planTurn.routed_skill).toBe("plan-proposal");
    const proposal = core.resolvePinnedProposal(tenant.tenant_id, campaign.campaign_id);
    expect(proposal?.gate_state).toBe("blocked");
    expect(proposal?.payload.budget_split).toBeNull();
    expect(proposal?.open_questions.some((q) => q.field === "budget_split")).toBe(true);
    expect(JSON.stringify(proposal?.payload)).not.toMatch(/800000|CPA/);
    await session.close();
  });

  it("without a pinned Brief, 出方案 asks instead of inventing a Proposal", async () => {
    const tenant = demoTenant();
    const core = new CampaignCore();
    const campaign = core.createCampaign({ tenant_id: tenant.tenant_id, name: "空场" });
    const session = await new LocalLoopAdapter(core).createSession(
      isolateRuntime(tenant, "beauty-essence-campaign", SKILLS_ROOT),
      campaign.campaign_id,
    );
    const turn = await session.turn({ text: "出方案" });
    expect(turn.routed_skill).toBe("plan-proposal");
    expect(turn.status).toBe("blocked");
    expect(turn.notes).toContain("brief_not_pinned");
    expect(core.resolvePinnedProposal(tenant.tenant_id, campaign.campaign_id)).toBeUndefined();
    const thread = core.thread(tenant.tenant_id, campaign.campaign_id);
    expect(thread.some((msg) => msg.agent_name === "plan" && msg.text.includes("先丢 Brief"))).toBe(true);
    await session.close();
  });

  it("support agent cannot load plan-proposal", async () => {
    const tenant = demoTenant();
    const core = new CampaignCore();
    const campaign = core.createCampaign({ tenant_id: tenant.tenant_id, name: "客服" });
    const session = await new LocalLoopAdapter(core).createSession(
      isolateRuntime(tenant, "cs-faq", SKILLS_ROOT),
      campaign.campaign_id,
    );
    expect(session.skillCatalog().map((s) => s.name)).not.toContain("plan-proposal");
    const turn = await session.turn({ text: "出方案" });
    expect(turn.routed_skill).toBeNull();
    expect(core.resolvePinnedProposal(tenant.tenant_id, campaign.campaign_id)).toBeUndefined();
    await session.close();
  });
});

describe("Gateway thread Brief → Proposal", () => {
  it("drop complete Brief through Gateway writes Brief + Proposal pins", async () => {
    const tenant = demoTenant();
    const core = new CampaignCore();
    const campaign = core.createCampaign({ tenant_id: tenant.tenant_id, name: "网关策划" });
    const session = await liveAdapter(core).createSession(
      isolateRuntime(tenant, "beauty-essence-campaign", SKILLS_ROOT),
      campaign.campaign_id,
    );
    const turn = await session.turn({
      attachment: {
        filename: "客户Brief.txt",
        bytes: Buffer.from(
          "目标：种草\nKPI：抖音完播\n预算：达人费 80 万、制作 20 万、周期 6 周\n平台：抖音\n卖点：屏障修护\n",
          "utf8",
        ),
      },
    });
    expect(turn.routed_skill).toBe("brief-parse");
    expect(turn.notes).toContain("chained_plan-proposal");
    const brief = core.resolvePinnedBrief(tenant.tenant_id, campaign.campaign_id);
    const proposal = core.resolvePinnedProposal(tenant.tenant_id, campaign.campaign_id);
    expect(brief?.version_id).toMatch(/:v1$/);
    expect(proposal?.version_id).toMatch(/:v1$/);
    expect(proposal?.payload.budget_split?.talent_fee).toBe(800000);
    expect(proposal?.type).toBe("Proposal");
    const second = await session.turn({ text: "出方案" });
    expect(second.routed_skill).toBe("plan-proposal");
    const again = core.resolvePinnedProposal(tenant.tenant_id, campaign.campaign_id);
    expect(again?.version).toBe(2);
    expect(again?.version_id).toBe(`${proposal?.object_id}:v2`);
    expect(core.artifacts.history(tenant.tenant_id, proposal!.object_id).map((item) => item.version)).toEqual([
      1, 2,
    ]);
    await session.close();
  });
});

describe("auto-chain follows campaign-core Brief gate, not harness band-object status", () => {
  it("treats a raw-only budget band as not ready even when KPIs exist", () => {
    expect(
      isBriefReadyToPlan(
        completeBrief({
          kpis: ["抖音完播"],
          budget_band: { raw: "待定" },
        }),
      ),
    ).toBe(false);
    expect(isBriefReadyToPlan(completeBrief())).toBe(true);
  });

  it("does not invoke plan turn when the pinned Brief gate is blocked", async () => {
    const runTurn = vi.fn();
    const result = await chainPlanProposalAfterBrief({
      catalog: [{ name: "plan-proposal", description: "x", version: "1.0", dir: "/tmp" }],
      briefResult: { routed_skill: "brief-parse", loaded_skill: null, status: "completed", notes: [] },
      pinnedBrief: {
        version_id: "brief_x:v1",
        object_id: "brief_x",
        version: 1,
        payload: completeBrief({
          kpis: ["抖音完播"],
          budget_band: { raw: "待定" },
        }),
        open_questions: [],
      },
      runTurn,
    });
    expect(result).toBeNull();
    expect(runTurn).not.toHaveBeenCalled();
  });
});
