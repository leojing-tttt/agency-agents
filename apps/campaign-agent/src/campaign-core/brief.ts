import type { BriefPayload, OpenQuestion } from "./types.ts";
import { newId } from "./ids.ts";

const REQUIRED_BRIEF_FIELDS = ["budget_band", "kpis"] as const;

export function openQuestionsForBrief(payload: BriefPayload): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  if (!payload.budget_band) {
    questions.push({
      id: newId("q"),
      assignee_role: "AE",
      field: "budget_band",
      question:
        "Brief 未给出预算带（达人费 / 制作费 / 周期）。不要编造金额，请 AE 补来源数字。",
      blocking: true,
    });
  } else if (
    payload.budget_band.talent_fee === undefined &&
    payload.budget_band.production === undefined
  ) {
    questions.push({
      id: newId("q"),
      assignee_role: "AE",
      field: "budget_band",
      question: `预算带只有原文「${payload.budget_band.raw}」，没有可落库的金额。禁止估算或四舍五入补数。`,
      blocking: true,
    });
  }
  if (payload.kpis.length === 0) {
    questions.push({
      id: newId("q"),
      assignee_role: "AE",
      field: "kpis",
      question: "Brief 未给出 KPI。不要编造完播、在看或 CPA，请 AE 确认客户指标。",
      blocking: true,
    });
  }
  return questions;
}

export function briefGateState(questions: OpenQuestion[]): "drafting" | "blocked" {
  return questions.some((item) => item.blocking) ? "blocked" : "drafting";
}

export { REQUIRED_BRIEF_FIELDS };
