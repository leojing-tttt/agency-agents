import type { BriefPayload } from "../src/campaign-core/types.ts";
import { describe, expect, it } from "vitest";
import { CampaignCore } from "../src/campaign-core/index.ts";
import { LocalLoopAdapter } from "../src/harness/local-loop.ts";
import { isolateRuntime, demoTenant, SKILLS_ROOT } from "../src/harness/tenant-runtime.ts";

function tenantCore() {
  const tenant = demoTenant();
  const core = new CampaignCore();
  const campaign = core.createCampaign({ tenant_id: tenant.tenant_id, name: "版本战役" });
  return { tenant, core, campaign };
}

function emptyBrief(overrides: Partial<BriefPayload> = {}): BriefPayload {
  return {
    objective: "种草",
    kpis: [],
    budget_band: null,
    platforms_include: [],
    platforms_exclude: [],
    talents_must_include: [],
    talents_must_exclude: [],
    selling_points: [],
    ban_claims: [],
    time_anchors: [],
    notes: null,
    ...overrides,
  };
}

describe("artifact versioning", () => {
  it("appends Brief versions and keeps old bytes readable", async () => {
    const { tenant, core, campaign } = tenantCore();
    const first = core.recordBrief({
      tenant_id: tenant.tenant_id,
      campaign_id: campaign.campaign_id,
      payload: {
        objective: "种草",
        kpis: ["抖音完播"],
        budget_band: { talent_fee: 800000, production: 200000, raw: "80+20" },
        platforms_include: ["抖音"],
        platforms_exclude: [],
        talents_must_include: [],
        talents_must_exclude: [],
        selling_points: [],
        ban_claims: [],
        time_anchors: [],
        notes: null,
      },
      citations: [],
    });
    expect(first.brief.version).toBe(1);
    expect(first.brief.version_id).toBe(`${first.brief.object_id}:v1`);

    const second = core.recordBrief({
      tenant_id: tenant.tenant_id,
      campaign_id: campaign.campaign_id,
      object_id: first.brief.object_id,
      payload: {
        ...first.brief.payload,
        kpis: ["小红书在看"],
      },
      citations: [],
    });
    expect(second.brief.version).toBe(2);
    expect(second.brief.supersedes_version).toBe(1);

    const v1 = core.artifacts.getVersion(tenant.tenant_id, first.brief.object_id, 1);
    expect(v1.payload).toMatchObject({ kpis: ["抖音完播"] });
    expect(core.artifacts.getVersion(tenant.tenant_id, first.brief.object_id, 2).payload).toMatchObject({
      kpis: ["小红书在看"],
    });
    expect(v1.created_at).not.toBe(second.brief.created_at);
  });

  it("pins memory to a version; thread cards are projections not truth", async () => {
    const { tenant, core, campaign } = tenantCore();
    const first = core.recordBrief({
      tenant_id: tenant.tenant_id,
      campaign_id: campaign.campaign_id,
      payload: emptyBrief({ kpis: ["旧KPI"], budget_band: { talent_fee: 1, raw: "1" } }),
      citations: [],
    });
    core.recordBrief({
      tenant_id: tenant.tenant_id,
      campaign_id: campaign.campaign_id,
      object_id: first.brief.object_id,
      payload: emptyBrief({ kpis: ["新KPI"], budget_band: { talent_fee: 2, raw: "2" } }),
      citations: [],
    });

    const pin = core.memory.activePin(tenant.tenant_id, campaign.campaign_id, "parsed_brief");
    expect(pin?.object_version).toBe(2);
    expect(pin?.version_id).toBe(`${first.brief.object_id}:v2`);

    const pinned = core.resolvePinnedBrief(tenant.tenant_id, campaign.campaign_id);
    expect(pinned?.payload.kpis).toEqual(["新KPI"]);

    const thread = core.thread(tenant.tenant_id, campaign.campaign_id);
    const cards = thread.filter((msg) => msg.artifact_ref);
    expect(cards[0]?.artifact_ref?.version).toBe(1);
    expect(cards[1]?.artifact_ref?.version).toBe(2);
    const hydratedOld = core.hydrateMessage(tenant.tenant_id, cards[0]!);
    expect(hydratedOld.text).toContain("旧KPI");
    expect(hydratedOld.text).not.toContain("新KPI");
  });

  it("does not use another tenant's artifact as latest", () => {
    const { tenant, core, campaign } = tenantCore();
    const recorded = core.recordBrief({
      tenant_id: tenant.tenant_id,
      campaign_id: campaign.campaign_id,
      payload: emptyBrief({ kpis: ["x"], budget_band: { talent_fee: 3, raw: "3" } }),
      citations: [],
    });
    expect(() =>
      core.artifacts.getVersion("other-office", recorded.brief.object_id, 1),
    ).toThrow(/tenant_isolation/);
  });
});

describe("local loop writes a versioned Brief from a file", () => {
  it("drop text brief → object with version_id and memory pin", async () => {
    const { tenant, core, campaign } = tenantCore();
    const session = await new LocalLoopAdapter(core).createSession(
      isolateRuntime(tenant, "beauty-essence-campaign", SKILLS_ROOT),
      campaign.campaign_id,
    );
    const source = Buffer.from(
      "目标：种草\nKPI：抖音完播\n预算：达人费 80 万、制作 20 万、周期 6 周\n",
      "utf8",
    );
    const turn = await session.turn({
      attachment: { filename: "客户Brief.txt", bytes: source },
    });
    expect(turn.routed_skill).toBe("brief-parse");
    const brief = core.resolvePinnedBrief(tenant.tenant_id, campaign.campaign_id);
    expect(brief?.version_id).toMatch(/:v1$/);
    expect(brief?.payload.kpis).toContain("抖音完播");
    expect(brief?.payload.budget_band?.talent_fee).toBe(800000);
    expect(core.memory.activePin(tenant.tenant_id, campaign.campaign_id, "parsed_brief")?.version_id).toBe(
      brief?.version_id,
    );
  });
});
