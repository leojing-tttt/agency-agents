import { afterEach, describe, expect, it } from "vitest";
import { CampaignCore } from "../src/campaign-core/index.ts";
import { OpenClawGatewayAdapter } from "../src/harness/openclaw-adapter.ts";
import { OpenClawGatewayUnavailableError } from "../src/harness/openclaw-client.ts";
import { OpenClawSupervisor } from "../src/harness/openclaw-supervisor.ts";
import { SkillLoadError } from "../src/harness/skill-loader.ts";
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

describe("OpenClaw Gateway is a real process", () => {
  it("fails closed when the Gateway is not running — no pretend pass", async () => {
    const adapter = new OpenClawGatewayAdapter({
      core: new CampaignCore(),
      spawn: false,
      url: "ws://127.0.0.1:9",
      token: "not-a-real-token",
    });
    await expect(
      adapter.createSession(isolateRuntime(demoTenant(), "beauty-essence-campaign", SKILLS_ROOT), "cmp_demo"),
    ).rejects.toThrow(OpenClawGatewayUnavailableError);
  });

  it("drop Brief through a live Gateway writes versioned Brief + memory pin", async () => {
    const tenant = demoTenant();
    const core = new CampaignCore();
    const campaign = core.createCampaign({ tenant_id: tenant.tenant_id, name: "网关战役" });
    const session = await liveAdapter(core).createSession(
      isolateRuntime(tenant, "beauty-essence-campaign", SKILLS_ROOT),
      campaign.campaign_id,
    );
    const turn = await session.turn({
      attachment: {
        filename: "客户Brief.txt",
        bytes: Buffer.from("目标：种草\nKPI：抖音完播\n预算：达人费 80 万、制作 20 万、周期 6 周\n", "utf8"),
      },
    });
    expect(turn.routed_skill).toBe("brief-parse");
    expect(turn.status).toBe("completed");
    const brief = core.resolvePinnedBrief(tenant.tenant_id, campaign.campaign_id);
    expect(brief?.version_id).toMatch(/:v1$/);
    expect(brief?.payload.kpis).toContain("抖音完播");
    expect(brief?.payload.budget_band?.talent_fee).toBe(800000);
    expect(core.memory.activePin(tenant.tenant_id, campaign.campaign_id, "parsed_brief")?.version_id).toBe(
      brief?.version_id,
    );
    await session.close();
  });

  it("support agent on the same tenant does not see brief-parse or talent MCP", async () => {
    const tenant = demoTenant();
    const core = new CampaignCore();
    const campaign = core.createCampaign({ tenant_id: tenant.tenant_id, name: "客服" });
    const adapter = liveAdapter(core);
    const support = await adapter.createSession(isolateRuntime(tenant, "cs-faq", SKILLS_ROOT), campaign.campaign_id);
    expect(support.skillCatalog()).toEqual([]);
    expect(support.mcpTools().map((t) => t.handle)).toEqual(["tickets/read_ticket"]);
    expect(support.mcpTools().some((t) => t.name === "rate_card" || t.name === "search_talent")).toBe(false);
    await expect(support.activateSkill("brief-parse")).rejects.toBeInstanceOf(SkillLoadError);
    const turn = await support.turn({
      attachment: {
        filename: "brief.txt",
        bytes: Buffer.from("目标：种草\nKPI：抖音完播\n预算：达人费 80 万\n"),
      },
    });
    expect(turn.routed_skill).toBeNull();
    expect(turn.status).toBe("ignored");
    expect(core.resolvePinnedBrief(tenant.tenant_id, campaign.campaign_id)).toBeUndefined();
    await support.close();
  });

  it("two tenants do not share a tool dump across Gateway processes", async () => {
    const core = new CampaignCore();
    const adapter = liveAdapter(core);
    const beautyTenant = demoTenant("office-beauty");
    const otherTenant = demoTenant("office-support-only");
    otherTenant.mcp_servers = [{ server_id: "tickets", tools: ["read_ticket"] }];
    otherTenant.published_agents = [otherTenant.published_agents[1]!];

    const beautyCampaign = core.createCampaign({ tenant_id: beautyTenant.tenant_id, name: "美妆" });
    const otherCampaign = core.createCampaign({ tenant_id: otherTenant.tenant_id, name: "客服部" });

    const beauty = await adapter.createSession(
      isolateRuntime(beautyTenant, "beauty-essence-campaign", SKILLS_ROOT),
      beautyCampaign.campaign_id,
    );
    const other = await adapter.createSession(
      isolateRuntime(otherTenant, "cs-faq", SKILLS_ROOT),
      otherCampaign.campaign_id,
    );

    expect(beauty.mcpTools().map((t) => t.handle)).toEqual(["talent-mdm/search_talent"]);
    expect(beauty.skillCatalog().map((s) => s.name).sort()).toEqual(["brief-parse", "plan-proposal"]);
    expect(other.mcpTools().map((t) => t.handle)).toEqual(["tickets/read_ticket"]);
    expect(other.skillCatalog()).toEqual([]);
    expect(other.mcpTools().some((t) => t.handle.includes("talent-mdm"))).toBe(false);
    await beauty.close();
    await other.close();
  });

  it("concurrent ensure for one tenant reuses a single ready Gateway process", async () => {
    const tenant = demoTenant("office-once");
    const supervisor = new OpenClawSupervisor();
    adapters.push(new OpenClawGatewayAdapter({ core: new CampaignCore(), supervisor }));
    const firstP = supervisor.ensure({ tenant, skillsRoot: SKILLS_ROOT });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const [first, second] = await Promise.all([
      firstP,
      supervisor.ensure({ tenant, skillsRoot: SKILLS_ROOT }),
    ]);
    expect(first.port).toBeGreaterThan(0);
    expect(first.url).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/);
    expect(second.port).toBe(first.port);
    expect(second.url).toBe(first.url);
  });

  it("stopAll kills a Gateway that is still starting", async () => {
    const tenant = demoTenant("office-stopall");
    const supervisor = new OpenClawSupervisor();
    adapters.push(new OpenClawGatewayAdapter({ core: new CampaignCore(), supervisor }));
    const started = supervisor.ensure({ tenant, skillsRoot: SKILLS_ROOT });
    await new Promise((resolve) => setTimeout(resolve, 30));
    await supervisor.stopAll();
    await expect(started).rejects.toThrow(/openclaw_gateway/);
  });

  it("does not serve Control UI from the Gateway HTTP surface", async () => {
    const tenant = demoTenant("office-noui");
    const core = new CampaignCore();
    const campaign = core.createCampaign({ tenant_id: tenant.tenant_id, name: "无控制台" });
    const adapter = liveAdapter(core);
    const session = await adapter.createSession(
      isolateRuntime(tenant, "beauty-essence-campaign", SKILLS_ROOT),
      campaign.campaign_id,
    );
    const supervised = await adapter.supervisor.ensure({ tenant, skillsRoot: SKILLS_ROOT });
    const res = await fetch(`http://127.0.0.1:${supervised.port}/`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("control_ui_disabled");
    const ready = await fetch(`http://127.0.0.1:${supervised.port}/readyz`);
    expect(ready.ok).toBe(true);
    expect(((await ready.json()) as { controlUi: boolean }).controlUi).toBe(false);
    await session.close();
  });
});
