#!/usr/bin/env node
/**
 * Deterministic Proposal drafter bundled with the plan-proposal skill.
 * Reads a pinned Brief version. Never invents budget, KPI, audience, or talent names.
 * Does not write ContentPack or lock a shortlist.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PAGE_OUTLINE = [
  { title: "封面", purpose: "战役名与一句主张" },
  { title: "目录", purpose: "页结构" },
  { title: "洞察", purpose: "insight" },
  { title: "策略主张", purpose: "strategy_idea" },
  { title: "媒介玩法", purpose: "platform_play" },
  { title: "达人逻辑", purpose: "结构约束，不锁名单" },
  { title: "内容钩子", purpose: "sample_content_hooks" },
  { title: "排期", purpose: "phasing" },
  { title: "预算", purpose: "budget_split 对 Brief 带" },
  { title: "附录", purpose: "citations / 缺项" },
];

const FORMAT_BY_PLATFORM = {
  小红书: "图文",
  抖音: "短视频",
  视频号: "短视频",
  微博: "图文",
  B站: "中视频",
  Xiaohongshu: "图文",
  Douyin: "短视频",
  TikTok: "短视频",
};

/**
 * @param {{
 *   brief: object,
 *   brief_version_id?: string,
 *   direction?: string,
 * }} input
 */
export function draftProposalFromBrief(input) {
  const brief = input.brief && typeof input.brief === "object" ? input.brief : {};
  const brief_version_id = String(input.brief_version_id || "");
  const selling = asStringArray(brief.selling_points);
  const bans = asStringArray(brief.ban_claims);
  const objective = typeof brief.objective === "string" && brief.objective.trim() ? brief.objective.trim() : null;
  const include = asStringArray(brief.platforms_include);
  const exclude = asStringArray(brief.platforms_exclude);
  const mustTalent = asStringArray(brief.talents_must_include);
  const anchors = asStringArray(brief.time_anchors);
  const kpis = asStringArray(brief.kpis);

  const strategy_idea = buildStrategyIdea({ objective, selling, bans, direction: input.direction });
  const insight = buildInsight({ objective, selling, mustTalent, kpis });
  const comm_idea = buildCommIdea({ selling, bans });
  const platform_play = buildPlatformPlay({ include, exclude, objective });
  const budget_split = copyBudgetSplit(brief.budget_band);
  const sample_content_hooks = selling.map((point) => `钩子：${point}（不是成稿，不拆 ContentPack）`);

  const citations = [];
  if (brief_version_id) {
    citations.push({
      source_filename: `brief:${brief_version_id}`,
      quote: strategy_idea || "no strategy_idea",
    });
  }

  return {
    payload: {
      insight,
      strategy_idea,
      comm_idea,
      audience: null,
      platform_play,
      budget_split,
      phasing: [...anchors],
      pages: PAGE_OUTLINE.map((page) => ({ ...page })),
      sample_content_hooks,
      source_brief_version_id: brief_version_id,
    },
    citations,
    invented: false,
  };
}

function buildStrategyIdea({ objective, selling, bans, direction }) {
  const extra = typeof direction === "string" ? direction.replace(/出方案|策划|定主张/g, "").trim() : "";
  const banBit = bans.length ? `禁用「${bans.join("、")}」` : "禁用 Brief 里的禁区说法";
  if (objective && selling.length) {
    const core = `把「${selling[0]}」做成可感知的${objective}主张，${banBit}；平台玩法和钩子都引用这一句。`;
    return extra && extra.length < 80 ? `${core}方向：${extra}` : core;
  }
  if (objective) {
    return `本场先钉「${objective}」：后面的平台玩法服务这个目标，不写空转页。卖点以 Brief 为准，不编造功效。`;
  }
  if (selling.length) {
    return `主张落在「${selling.join("、")}」，先让人相信这些点，再谈平台和达人结构。`;
  }
  return null;
}

function buildInsight({ objective, selling, mustTalent, kpis }) {
  const bits = [];
  if (objective) {
    bits.push(`客户要的是${objective}`);
  }
  if (selling.length) {
    bits.push(`卖点落在${selling.join("、")}`);
  }
  if (kpis.length) {
    bits.push(`考核 ${kpis.join(" / ")}`);
  }
  if (mustTalent.length) {
    bits.push(`达人结构约束：${mustTalent.join("、")}（本方案不锁名单）`);
  }
  if (!bits.length) {
    return null;
  }
  return `${bits.join("。")}。`;
}

function buildCommIdea({ selling, bans }) {
  if (!selling.length && !bans.length) {
    return null;
  }
  const say = selling.length ? `只说 ${selling.join("、")}` : "只说 Brief 里有的点";
  const dont = bans.length ? `，不说 ${bans.join("、")}` : "";
  return `${say}${dont}。`;
}

function buildPlatformPlay({ include, exclude, objective }) {
  const role = objective === "转化" ? "转化" : "种草";
  const plays = [];
  for (const platform of include) {
    if (exclude.some((item) => platform.includes(item) || item.includes(platform))) {
      continue;
    }
    plays.push({
      platform,
      format: FORMAT_BY_PLATFORM[platform] || "短内容",
      role,
    });
  }
  return plays;
}

function copyBudgetSplit(band) {
  if (!band || typeof band !== "object") {
    return null;
  }
  const split = {
    raw: typeof band.raw === "string" ? band.raw : "",
    matches_brief_band: true,
  };
  if (typeof band.talent_fee === "number") {
    split.talent_fee = band.talent_fee;
  }
  if (typeof band.production === "number") {
    split.production = band.production;
  }
  if (typeof band.currency === "string") {
    split.currency = band.currency;
  }
  if (split.talent_fee === undefined && split.production === undefined && !split.raw) {
    return null;
  }
  return split;
}

function asStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item).trim()).filter(Boolean);
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: draft-proposal.mjs <brief.json>");
    process.exit(2);
  }
  const brief = JSON.parse(readFileSync(file, "utf8"));
  const result = draftProposalFromBrief({
    brief: brief.payload || brief,
    brief_version_id: brief.version_id,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
