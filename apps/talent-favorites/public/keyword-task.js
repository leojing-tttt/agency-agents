/** Keyword find-account (关键词找号) task helpers. Shared by the page and tests. */

export const NAME_MAX = 50;
export const NOTE_COUNT_MIN = 1;
export const NOTE_COUNT_MAX = 500;
export const DURATION_MIN = 1;
export const DURATION_MAX = 365;

export const BRANDS = [
  { id: "kotex", name: "高洁丝", lines: ["卫生巾", "护垫", "裤型卫生巾"] },
  { id: "huggies", name: "好奇", lines: ["纸尿裤", "拉拉裤", "湿巾"] },
  { id: "pampers", name: "帮宝适", lines: ["纸尿裤", "拉拉裤"] },
  { id: "meadjohnson", name: "美赞臣", lines: ["婴幼儿配方奶粉", "营养品"] },
  { id: "aptamil", name: "爱他美", lines: ["婴幼儿配方奶粉"] },
];

export const SORT_OPTIONS = ["综合", "最新", "最多点赞", "最多评论", "最多收藏"];
export const PUBLISH_OPTIONS = ["不限", "一天内", "一周内", "一个月内", "三个月内", "半年内", "一年内"];

const LINK_RE = /https?:\/\/|www\.|xhslink\.com|xiaohongshu\.com/i;

export function parseKeywords(text) {
  return String(text ?? "")
    .split(/[\n，]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function keywordHasLink(keyword) {
  return LINK_RE.test(String(keyword ?? ""));
}

export function findBrand(brandId) {
  return BRANDS.find((brand) => brand.id === brandId) ?? null;
}

export function linesForBrand(brandId) {
  return findBrand(brandId)?.lines ?? [];
}

/**
 * @typedef {{
 *   name: string,
 *   brandId: string,
 *   brandName: string,
 *   lineId: string,
 *   keywords: string[],
 *   noteCount: number,
 *   cycle: "once" | "daily",
 *   durationDays: number | null,
 *   sortBy: string,
 *   publishTime: string
 * }} KeywordTask
 * @param {Record<string, unknown>} input
 * @returns {{ ok: true, value: KeywordTask } | { ok: false, errors: Record<string, string> }}
 */
export function validateKeywordTask(input) {
  const errors = {};
  const name = String(input?.name ?? "").trim();
  if (!name) {
    errors.name = "请输入任务名称";
  } else if (name.length > NAME_MAX) {
    errors.name = `任务名称不超过 ${NAME_MAX} 个字符`;
  }

  const brandId = String(input?.brandId ?? "").trim();
  if (!brandId) {
    errors.brandId = "请选择品牌";
  } else if (!findBrand(brandId)) {
    errors.brandId = "请选择有效品牌";
  }

  const allowedLines = linesForBrand(brandId);
  const lineId = String(input?.lineId ?? "").trim();
  if (lineId && !allowedLines.includes(lineId)) {
    errors.lineId = "请先选择品牌后再选择品线";
  }

  const keywords = parseKeywords(input?.keywordsText);
  if (!keywords.length) {
    errors.keywordsText = "请输入监控关键词";
  } else if (keywords.some(keywordHasLink)) {
    errors.keywordsText = "不支持输入链接，含链接将无法提交";
  }

  const noteCount = Number(input?.noteCount);
  if (!Number.isInteger(noteCount) || noteCount < NOTE_COUNT_MIN || noteCount > NOTE_COUNT_MAX) {
    errors.noteCount = `请输入 ${NOTE_COUNT_MIN}–${NOTE_COUNT_MAX} 的采集数量`;
  }

  const cycle = input?.cycle === "daily" ? "daily" : input?.cycle === "once" ? "once" : "";
  if (!cycle) {
    errors.cycle = "请选择监控周期";
  }

  let durationDays = null;
  if (cycle === "daily") {
    durationDays = Number(input?.durationDays);
    if (!Number.isInteger(durationDays) || durationDays < DURATION_MIN || durationDays > DURATION_MAX) {
      errors.durationDays = `请输入持续更新 ${DURATION_MIN}–${DURATION_MAX} 天`;
    }
  }

  const sortBy = String(input?.sortBy ?? "").trim();
  if (!sortBy) {
    errors.sortBy = "请选择排序依据";
  } else if (!SORT_OPTIONS.includes(sortBy)) {
    errors.sortBy = "请选择有效的排序依据";
  }

  const publishTime = String(input?.publishTime ?? "").trim();
  if (!publishTime) {
    errors.publishTime = "请选择发布时间";
  } else if (!PUBLISH_OPTIONS.includes(publishTime)) {
    errors.publishTime = "请选择有效的发布时间";
  }

  if (Object.keys(errors).length) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name,
      brandId,
      brandName: findBrand(brandId).name,
      lineId: lineId || "",
      keywords,
      noteCount,
      cycle,
      durationDays,
      sortBy,
      publishTime,
    },
  };
}
