import { pathToFileURL } from "node:url";
import path from "node:path";
import { CampaignCore } from "../campaign-core/index.ts";
import type {
  BriefPayload,
  Citation,
  OpenQuestion,
  ProposalPayload,
} from "../campaign-core/types.ts";
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

type DraftProposalModule = {
  draftProposalFromBrief: (input: {
    brief: BriefPayload;
    brief_version_id?: string;
    direction?: string;
  }) => { payload: ProposalPayload; citations: Citation[] };
};

export type PinnedBriefInput = {
  version_id: string;
  object_id: string;
  version: number;
  payload: BriefPayload;
  open_questions: OpenQuestion[];
};

export type SkillTurnResult = SessionTurnResult & {
  parsed?: { payload: BriefPayload; citations: Citation[] };
  proposal?: { payload: ProposalPayload; citations: Citation[] };
};

/**
 * One harness-loop step: route a dropped Brief to `brief-parse`, or a plan
 * request to `plan-proposal`, and run the bundled script.
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

  if (looksLikePlanIntent(input.turn.text)) {
    if (!input.catalog.some((item) => item.name === "plan-proposal")) {
      notes.push("plan-proposal_not_on_allowlist");
      return { routed_skill: null, loaded_skill: null, status: "ignored", notes };
    }
    const loaded = await input.activateSkill("plan-proposal");
    const pinned = input.turn.pinned_brief;
    if (!pinned) {
      notes.push("brief_not_pinned");
      return { routed_skill: "plan-proposal", loaded_skill: loaded, status: "blocked", notes };
    }
    const proposal = await runDraftProposalScript(loaded, pinned, input.turn.text);
    const hasStrategy = Boolean(proposal.payload.strategy_idea?.trim());
    const budgetOk = Boolean(
      proposal.payload.budget_split &&
        (proposal.payload.budget_split.talent_fee !== undefined ||
          proposal.payload.budget_split.production !== undefined) &&
        proposal.payload.budget_split.matches_brief_band,
    );
    return {
      routed_skill: "plan-proposal",
      loaded_skill: loaded,
      status: hasStrategy && budgetOk ? "completed" : "blocked",
      notes,
      proposal,
    };
  }

  if (input.turn.text && /brief|纪要|客户要/i.test(input.turn.text) && input.catalog.some((item) => item.name === "brief-parse")) {
    notes.push("text_without_file_is_not_a_brief_source");
  }
  return { routed_skill: null, loaded_skill: null, status: "ignored", notes };
}

export function looksLikePlanIntent(text?: string): boolean {
  if (!text) {
    return false;
  }
  return /(出方案|策划|方案大纲|定主张|proposal|strategy_idea|plan-proposal|\bplan\b)/i.test(text);
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

export async function runDraftProposalScript(
  skill: LoadedSkill,
  pinned: PinnedBriefInput,
  direction?: string,
): Promise<{ payload: ProposalPayload; citations: Citation[] }> {
  const scriptRel = skill.bundled.scripts.find((item) => item.endsWith("draft-proposal.mjs"));
  if (!scriptRel) {
    throw new Error("plan-proposal skill is missing scripts/draft-proposal.mjs");
  }
  const scriptPath = path.join(skill.dir, scriptRel);
  const mod = (await import(pathToFileURL(scriptPath).href)) as DraftProposalModule;
  return mod.draftProposalFromBrief({
    brief: pinned.payload,
    brief_version_id: pinned.version_id,
    direction,
  });
}

export function pinnedBriefInput(
  core: CampaignCore,
  tenantId: string,
  campaignId: string,
): PinnedBriefInput | undefined {
  const brief = core.resolvePinnedBrief(tenantId, campaignId);
  if (!brief) {
    return undefined;
  }
  return {
    version_id: brief.version_id,
    object_id: brief.object_id,
    version: brief.version,
    payload: brief.payload,
    open_questions: brief.open_questions,
  };
}

export function commitSkillResult(
  core: CampaignCore,
  tenantId: string,
  campaignId: string,
  result: SkillTurnResult,
): void {
  if (result.routed_skill === "brief-parse" && result.parsed) {
    core.recordBrief({
      tenant_id: tenantId,
      campaign_id: campaignId,
      payload: result.parsed.payload,
      citations: result.parsed.citations,
    });
    return;
  }
  if (result.routed_skill !== "plan-proposal") {
    return;
  }
  if (result.notes.includes("brief_not_pinned")) {
    core.recordPlannerBlocked({
      tenant_id: tenantId,
      campaign_id: campaignId,
      reason: "brief_not_pinned",
    });
    return;
  }
  if (result.proposal) {
    core.recordProposal({
      tenant_id: tenantId,
      campaign_id: campaignId,
      payload: result.proposal.payload,
      citations: result.proposal.citations,
    });
  }
}

export async function chainPlanProposalAfterBrief(input: {
  catalog: SkillSummary[];
  briefResult: SkillTurnResult;
  pinnedBrief?: PinnedBriefInput;
  runTurn: (turn: SessionTurnInput) => Promise<SkillTurnResult>;
}): Promise<SkillTurnResult | null> {
  if (input.briefResult.routed_skill !== "brief-parse" || input.briefResult.status !== "completed") {
    return null;
  }
  if (!input.catalog.some((item) => item.name === "plan-proposal")) {
    return null;
  }
  if (!input.pinnedBrief) {
    return null;
  }
  return input.runTurn({ text: "出方案", pinned_brief: input.pinnedBrief });
}
