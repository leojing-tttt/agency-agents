import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CampaignCore } from "../campaign-core/index.ts";
import { LocalLoopAdapter } from "../harness/local-loop.ts";
import { isolateRuntime, demoTenant, SKILLS_ROOT } from "../harness/tenant-runtime.ts";
import { writeSamplePdf } from "./sample-pdf.ts";

export async function runDemo(filePath: string) {
  const tenant = demoTenant();
  const core = new CampaignCore();
  const campaign = core.createCampaign({
    tenant_id: tenant.tenant_id,
    name: "美妆精华 Q3 种草",
  });
  const runtime = isolateRuntime(tenant, "beauty-essence-campaign", SKILLS_ROOT);
  const harness = new LocalLoopAdapter(core);
  const session = await harness.createSession(runtime, campaign.campaign_id);
  const bytes = await readFile(filePath);
  const turn = await session.turn({
    attachment: { filename: path.basename(filePath), bytes },
  });
  const snap = core.snapshot(tenant.tenant_id, campaign.campaign_id);
  const catalog = session.skillCatalog();
  const mcp = session.mcpTools();
  await session.close();
  return { turn, snap, catalog, mcp };
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("usage: npm run demo -- <brief.txt|brief.pdf>");
    console.error("example: npm run demo -- fixtures/briefs/complete.txt");
    process.exit(2);
  }
  if (target === "--write-sample-pdf") {
    const out = process.argv[3] || path.join(SKILLS_ROOT, "../fixtures/briefs/complete.pdf");
    await writeSamplePdf(out, await readFile(path.join(SKILLS_ROOT, "../fixtures/briefs/complete.txt"), "utf8"));
    console.log(`wrote ${out}`);
    return;
  }
  const result = await runDemo(path.resolve(target));
  const brief = result.snap.pinned_brief;
  console.log(`harness: local-loop (OpenClaw Gateway not embedded)`);
  console.log(`skills: ${result.catalog.map((s) => s.name).join(", ") || "(none)"}`);
  console.log(`mcp: ${result.mcp.map((t) => t.handle).join(", ") || "(none)"}`);
  console.log(`routed: ${result.turn.routed_skill} status=${result.turn.status}`);
  if (!brief) {
    console.log("no Brief artifact");
    return;
  }
  console.log(`Brief ${brief.version_id} gate=${brief.gate_state}`);
  console.log(JSON.stringify(brief.payload, null, 2));
  console.log("open_questions:", brief.open_questions);
  console.log(
    "memory pins:",
    result.snap.memory.map((p) => `${p.kind}->${p.version_id}`).join(", "),
  );
  console.log(
    `content surface: ${result.snap.content.kind} cards=${result.snap.content.cards.length}`,
  );
}

const entry = process.argv[1];
const isMain =
  entry !== undefined && import.meta.url === pathToFileURL(path.resolve(entry)).href;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
