import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SkillLibrary, SkillLoadError } from "../src/harness/skill-loader.ts";
import { OpenClawGatewayAdapter } from "../src/harness/openclaw-adapter.ts";
import { OpenClawGatewayUnavailableError } from "../src/harness/openclaw-client.ts";
import { OpenClawSupervisor } from "../src/harness/openclaw-supervisor.ts";
import { CampaignCore } from "../src/campaign-core/index.ts";
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

describe("skill load (Agent Skills spec)", () => {
  it("discovers brief-parse and plan-proposal SKILL.md with names matching directories", async () => {
    const library = new SkillLibrary(SKILLS_ROOT);
    const all = await library.discover();
    expect(all.map((s) => s.name).sort()).toEqual(["brief-parse", "plan-proposal"]);
    const skill = all.find((s) => s.name === "brief-parse");
    expect(skill?.description).toMatch(/Brief/);
    expect(skill?.dir.endsWith(`${path.sep}brief-parse`)).toBe(true);
  });

  it("session catalog only includes allowlisted skills and only name+description", async () => {
    const tenant = demoTenant();
    const core = new CampaignCore();
    const campaign = core.createCampaign({ tenant_id: tenant.tenant_id, name: "x" });
    const session = await liveAdapter(core).createSession(
      isolateRuntime(tenant, "beauty-essence-campaign", SKILLS_ROOT),
      campaign.campaign_id,
    );
    const catalog = session.skillCatalog();
    expect(catalog.map((s) => s.name).sort()).toEqual(["brief-parse", "plan-proposal"]);
    const briefSummary = catalog.find((item) => item.name === "brief-parse");
    expect(briefSummary).toEqual(
      expect.objectContaining({
        name: "brief-parse",
        description: expect.any(String),
        version: "1.0",
      }),
    );
    expect(briefSummary).not.toHaveProperty("instructions");
    expect(briefSummary).not.toHaveProperty("files");
    for (const item of catalog) {
      expect(item).not.toHaveProperty("instructions");
      expect(item).not.toHaveProperty("files");
    }

    const loaded = await session.activateSkill("brief-parse");
    expect(loaded.instructions).toMatch(/When to use/);
    expect(loaded.bundled.scripts).toContain("scripts/parse-brief.mjs");
    expect(loaded.bundled.references).toContain("references/brief-schema.md");
    expect(loaded.files["SKILL.md"]).toMatch(/^---/);
    const plan = await session.activateSkill("plan-proposal");
    expect(plan.instructions).toMatch(/When to use/);
    expect(plan.bundled.scripts).toContain("scripts/draft-proposal.mjs");
    expect(plan.bundled.references).toContain("references/proposal-schema.md");
    await expect(session.activateSkill("talent-shortlist")).rejects.toBeInstanceOf(SkillLoadError);
    await session.close();
  });

  it("support agent does not see brief-parse even though the files exist on disk", async () => {
    const tenant = demoTenant();
    const core = new CampaignCore();
    const campaign = core.createCampaign({ tenant_id: tenant.tenant_id, name: "客服" });
    const session = await liveAdapter(core).createSession(
      isolateRuntime(tenant, "cs-faq", SKILLS_ROOT),
      campaign.campaign_id,
    );
    expect(session.skillCatalog()).toEqual([]);
    expect(session.mcpTools().map((t) => t.handle)).toEqual(["tickets/read_ticket"]);
    expect(session.mcpTools().some((t) => t.name === "rate_card")).toBe(false);
    await expect(session.activateSkill("brief-parse")).rejects.toThrow(/skill_not_allowed/);
    await expect(session.activateSkill("plan-proposal")).rejects.toThrow(/skill_not_allowed/);
    await session.close();
  });

  it("rejects SKILL.md whose name does not match the parent directory", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "skills-"));
    const dir = path.join(root, "wrong-dir");
    await mkdir(dir);
    await writeFile(
      path.join(dir, "SKILL.md"),
      `---\nname: other-name\ndescription: x\n---\n\nbody\n`,
    );
    const library = new SkillLibrary(root);
    await expect(library.discover()).rejects.toThrow(SkillLoadError);
  });

  it("does not pretend a missing OpenClaw Gateway is running", async () => {
    await expect(
      new OpenClawGatewayAdapter({
        core: new CampaignCore(),
        spawn: false,
        url: "ws://127.0.0.1:9",
        token: "nope",
      }).createSession(isolateRuntime(demoTenant(), "beauty-essence-campaign", SKILLS_ROOT), "cmp_demo"),
    ).rejects.toThrow(OpenClawGatewayUnavailableError);
  });
});
