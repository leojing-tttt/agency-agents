import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { CampaignCore } from "../src/campaign-core/index.ts";
import { extractSourceText } from "../src/harness/source-text.ts";
import { buildSamplePdf } from "../src/demo/sample-pdf.ts";
import { runParseBriefScript } from "../src/harness/skill-turn.ts";
import { OpenClawGatewayAdapter } from "../src/harness/openclaw-adapter.ts";
import { OpenClawSupervisor } from "../src/harness/openclaw-supervisor.ts";
import { demoTenant, isolateRuntime, SKILLS_ROOT } from "../src/harness/tenant-runtime.ts";
import { SkillLibrary } from "../src/harness/skill-loader.ts";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/briefs");

async function parseFile(rel: string) {
  const filename = path.basename(rel);
  const bytes = await readFile(path.join(fixtures, rel));
  const extracted = extractSourceText(filename, bytes);
  const library = new SkillLibrary(SKILLS_ROOT);
  const skill = await library.activate("brief-parse", [{ skill_id: "brief-parse", version: "1.0" }]);
  return runParseBriefScript(skill, extracted, filename);
}

describe("brief-parse refuses to invent budget/KPI", () => {
  it("extracts amounts only when the source has them", async () => {
    const parsed = await parseFile("complete.txt");
    expect(parsed.payload.objective).toBe("种草");
    expect(parsed.payload.kpis).toEqual(["抖音完播", "小红书在看"]);
    expect(parsed.payload.budget_band?.talent_fee).toBe(800000);
    expect(parsed.payload.budget_band?.production).toBe(200000);
    expect(parsed.payload.budget_band?.period_weeks).toBe(6);
    expect(parsed.payload.platforms_exclude).toContain("直播");
  });

  it("leaves budget and KPI empty and records open_questions instead of defaults", async () => {
    const parsed = await parseFile("missing-budget-kpi.txt");
    expect(parsed.payload.budget_band).toBeNull();
    expect(parsed.payload.kpis).toEqual([]);
    expect(parsed.payload.objective).toBe("种草");
    expect(JSON.stringify(parsed.payload)).not.toMatch(/800000|完播|CPA/);

    const tenant = demoTenant();
    const core = new CampaignCore();
    const campaign = core.createCampaign({ tenant_id: tenant.tenant_id, name: "缺项" });
    const { brief } = core.recordBrief({
      tenant_id: tenant.tenant_id,
      campaign_id: campaign.campaign_id,
      payload: parsed.payload,
      citations: parsed.citations,
    });
    expect(brief.gate_state).toBe("blocked");
    const fields = brief.open_questions.map((q) => q.field).sort();
    expect(fields).toEqual(["budget_band", "kpis"]);
    expect(brief.open_questions.every((q) => q.blocking && q.assignee_role === "AE")).toBe(true);
    expect(brief.payload.budget_band).toBeNull();
    expect(brief.payload.kpis).toEqual([]);
  });

  it("parses a UTF-16BE sample PDF through the same skill script", async () => {
    const text = await readFile(path.join(fixtures, "complete.txt"), "utf8");
    const pdf = buildSamplePdf(text);
    const extracted = extractSourceText("complete.pdf", pdf);
    expect(extracted.text).toContain("KPI");
    const library = new SkillLibrary(SKILLS_ROOT);
    const skill = await library.activate("brief-parse", [{ skill_id: "brief-parse", version: "1.0" }]);
    const parsed = await runParseBriefScript(skill, extracted, "complete.pdf");
    expect(parsed.payload.budget_band?.talent_fee).toBe(800000);
    expect(parsed.payload.kpis.length).toBeGreaterThan(0);
  });

  it("support agent drop is not routed to brief-parse", async () => {
    const tenant = demoTenant();
    const core = new CampaignCore();
    const campaign = core.createCampaign({ tenant_id: tenant.tenant_id, name: "客服" });
    const harness = new OpenClawGatewayAdapter({ core, supervisor: new OpenClawSupervisor() });
    try {
      const session = await harness.createSession(
        isolateRuntime(tenant, "cs-faq", SKILLS_ROOT),
        campaign.campaign_id,
      );
      const turn = await session.turn({
        attachment: {
          filename: "brief.txt",
          bytes: Buffer.from("目标：种草\nKPI：抖音完播\n预算：达人费 80 万\n"),
        },
      });
      expect(turn.routed_skill).toBeNull();
      expect(turn.status).toBe("ignored");
      expect(core.resolvePinnedBrief(tenant.tenant_id, campaign.campaign_id)).toBeUndefined();
      await session.close();
    } finally {
      await harness.stop();
    }
  });
});

describe("bundled script is a real module", () => {
  it("can be imported from the skill directory", async () => {
    const href = pathToFileURL(
      path.join(SKILLS_ROOT, "brief-parse/scripts/parse-brief.mjs"),
    ).href;
    const mod = await import(href);
    expect(typeof mod.parseBriefSource).toBe("function");
  });
});
