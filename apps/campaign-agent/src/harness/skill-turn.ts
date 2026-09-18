import { pathToFileURL } from "node:url";
import path from "node:path";
import type { BriefPayload, Citation } from "../campaign-core/types.ts";
import type { LoadedSkill, SkillSummary } from "./skill-loader.ts";
import { extractSourceText, looksLikeBrief } from "./source-text.ts";
import type { SessionTurnInput, SessionTurnResult } from "./openclaw-adapter.ts";

type ParseBriefModule = {
  parseBriefSource: (input: {
    text: string;
    filename?: string;
    pages?: string[];
  }) => { payload: BriefPayload; citations: Citation[] };
};

export type SkillTurnResult = SessionTurnResult & {
  parsed?: { payload: BriefPayload; citations: Citation[] };
};

/**
 * One harness-loop step: route a dropped Brief to `brief-parse` and run the
 * bundled script. Used inside the OpenClaw-compatible Gateway process.
 * Does not write campaign-core (the product app remains source of truth).
 */
export async function routeSkillTurn(input: {
  catalog: SkillSummary[];
  activateSkill: (name: string) => Promise<LoadedSkill>;
  turn: SessionTurnInput;
}): Promise<SkillTurnResult> {
  const notes: string[] = [];
  const attachment = input.turn.attachment;
  if (attachment) {
    const extracted = extractSourceText(attachment.filename, attachment.bytes);
    if (!looksLikeBrief(attachment.filename, extracted.text) && extracted.text.trim()) {
      notes.push("attachment_not_classified_as_brief");
    }
    if (!input.catalog.some((item) => item.name === "brief-parse")) {
      notes.push("brief-parse_not_on_allowlist");
      return { routed_skill: null, loaded_skill: null, status: "ignored", notes };
    }
    const loaded = await input.activateSkill("brief-parse");
    const parsed = await runParseBriefScript(loaded, extracted, attachment.filename);
    return {
      routed_skill: "brief-parse",
      loaded_skill: loaded,
      status: parsed.payload.budget_band && parsed.payload.kpis.length ? "completed" : "blocked",
      notes,
      parsed,
    };
  }

  if (input.turn.text && /brief|纪要|客户要/i.test(input.turn.text) && input.catalog.some((item) => item.name === "brief-parse")) {
    notes.push("text_without_file_is_not_a_brief_source");
  }
  return { routed_skill: null, loaded_skill: null, status: "ignored", notes };
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
