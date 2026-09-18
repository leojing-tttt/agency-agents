import type { BriefPayload, OpenQuestion, ProposalPayload } from "./types.ts";
import { newId } from "./ids.ts";

export function openQuestionsForProposal(
  payload: ProposalPayload,
  brief?: BriefPayload | null,
): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  if (!payload.strategy_idea || !payload.strategy_idea.trim()) {
    questions.push({
      id: newId("q"),
      assignee_role: "planner",
      field: "strategy_idea",
      question: "没有一句策略主张。不准出空转大纲。请策划给方向，或先补 Brief 的目标和卖点。",
      blocking: true,
    });
  }
  const band = brief?.budget_band;
  const briefHasAmount =
    typeof band?.talent_fee === "number" || typeof band?.production === "number";
  if (!band || !briefHasAmount) {
    questions.push({
      id: newId("q"),
      assignee_role: "AE",
      field: "budget_split",
      question: "Brief 预算带对不上可落库金额。禁止四舍五入或拆备用金糊弄，请 AE 补来源数字。",
      blocking: true,
    });
  } else if (!payload.budget_split || payload.budget_split.matches_brief_band !== true) {
    questions.push({
      id: newId("q"),
      assignee_role: "AE",
      field: "budget_split",
      question: "预算拆分与 Brief 预算带不一致。只许抄来源数字，禁止估算。",
      blocking: true,
    });
  } else {
    if (
      band.talent_fee !== undefined &&
      payload.budget_split.talent_fee !== band.talent_fee
    ) {
      questions.push({
        id: newId("q"),
        assignee_role: "AE",
        field: "budget_split",
        question: "达人费与 Brief 不一致，禁止改数。",
        blocking: true,
      });
    }
    if (
      band.production !== undefined &&
      payload.budget_split.production !== band.production
    ) {
      questions.push({
        id: newId("q"),
        assignee_role: "AE",
        field: "budget_split",
        question: "制作费与 Brief 不一致，禁止改数。",
        blocking: true,
      });
    }
  }
  return questions;
}

export function proposalGateState(questions: OpenQuestion[]): "drafting" | "blocked" {
  return questions.some((item) => item.blocking) ? "blocked" : "drafting";
}
