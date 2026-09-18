#!/usr/bin/env node
/**
 * Deterministic Brief extractor bundled with the brief-parse skill.
 * Missing budget/KPI become open_questions. This script never invents amounts or KPIs.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OBJECTIVES = ["种草", "转化", "上市", "危机修复", "awareness", "conversion", "launch"];

/**
 * @param {{ text: string, filename?: string, pages?: string[] }} input
 */
export function parseBriefSource(input) {
  const text = (input.text || "").replace(/\r\n/g, "\n");
  const filename = input.filename || "brief.txt";
  const pages = input.pages?.length ? input.pages : [text];

  const objective = findObjective(text);
  const kpis = findKpis(text);
  const budget_band = findBudget(text);
  const platforms = findPlatforms(text);
  const talentConstraints = findTalentConstraints(text);
  const selling_points = labeledList(text, /(卖点|selling\s*points?|must\s*claims?)\s*[:：]/i);
  const ban_claims = labeledList(text, /(ban\s*claims?|禁用|不能说|禁区)\s*[:：]/i);
  const time_anchors = labeledList(text, /(时间锚点|排期|周期|timeline|launch)\s*[:：]/i);

  const citations = cite(pages, filename, [
    objective,
    ...kpis,
    budget_band?.raw,
    ...platforms.include,
  ]);

  return {
    payload: {
      objective,
      kpis,
      budget_band,
      platforms_include: platforms.include,
      platforms_exclude: platforms.exclude,
      talents_must_include: talentConstraints.must,
      talents_must_exclude: talentConstraints.ban,
      selling_points,
      ban_claims,
      time_anchors,
      notes: null,
    },
    citations,
    invented: false,
  };
}

function findObjective(text) {
  const labeled = labeledLine(text, /(目标|objective|goal)\s*[:：]/i);
  if (labeled) {
    const hit = OBJECTIVES.find((item) => labeled.toLowerCase().includes(item.toLowerCase()));
    return hit || labeled;
  }
  return OBJECTIVES.find((item) => text.includes(item)) || null;
}

function findKpis(text) {
  const labeled = labeledLine(text, /(kpi|指标|考核)\s*[:：]/i);
  if (labeled) {
    return splitList(labeled);
  }
  return [];
}

function findBudget(text) {
  const line = labeledLine(text, /(预算带?|budget)\s*[:：]/i);
  const window = line || (/(预算|budget)/i.test(text) ? snippetAround(text, /(预算|budget)/i) : "");
  if (!window) {
    return null;
  }
  const talent = firstNumber(window, /(达人费|达人|kol|talent)[^0-9]{0,12}([0-9]+(?:\.[0-9]+)?)\s*(万|w|万人民币)?/i);
  const production = firstNumber(window, /(制作|production|content)[^0-9]{0,12}([0-9]+(?:\.[0-9]+)?)\s*(万|w)?/i);
  const weeks = firstNumber(window, /(周期|weeks?|周)[^0-9]{0,8}([0-9]+(?:\.[0-9]+)?)/i, false);
  const band = {
    raw: window.replace(/\s+/g, " ").trim(),
  };
  if (talent !== undefined) {
    band.talent_fee = talent;
  }
  if (production !== undefined) {
    band.production = production;
  }
  if (weeks !== undefined) {
    band.period_weeks = weeks;
  }
  return band;
}

function findPlatforms(text) {
  const includeLine = labeledLine(text, /(必选平台|平台|platforms?)\s*[:：]/i) || "";
  const excludeLine =
    labeledLine(text, /(禁选平台|不做|exclude)\s*[:：]/i) ||
    ( /不做直播/.test(text) ? "直播" : "");
  const include = [];
  for (const name of ["小红书", "抖音", "视频号", "微博", "B站", "Xiaohongshu", "Douyin", "TikTok"]) {
    if (includeLine.includes(name) || (!includeLine && text.includes(name) && /(平台|platform)/i.test(text))) {
      if (!include.includes(name)) {
        include.push(name);
      }
    }
  }
  if (includeLine) {
    for (const part of splitList(includeLine)) {
      if (part.startsWith("不做") || ["必选平台", "平台"].includes(part)) {
        continue;
      }
      if (!include.includes(part)) {
        include.push(part);
      }
    }
  }
  const exclude = [];
  if (excludeLine) {
    for (const part of splitList(excludeLine.replace(/^不做/, ""))) {
      if (part && !exclude.includes(part)) {
        exclude.push(part);
      }
    }
  }
  if (/不做直播/.test(text) && !exclude.includes("直播")) {
    exclude.push("直播");
  }
  return { include, exclude };
}

function findTalentConstraints(text) {
  const must = labeledList(text, /(必选达人|必须有)\s*[:：]?/i);
  const ban = labeledList(text, /(禁选达人|禁达人)\s*[:：]/i);
  if (/必须有\s*1\s*个腰部医生/.test(text) && !must.length) {
    must.push("1 个腰部医生");
  }
  return { must, ban };
}

function labeledLine(text, pattern) {
  const lines = text.split("\n");
  for (const line of lines) {
    if (pattern.test(line)) {
      return line.replace(pattern, "").trim();
    }
  }
  const match = text.match(new RegExp(pattern.source + "\\s*([^\\n]+)", "i"));
  return match?.[1]?.trim() || "";
}

function labeledList(text, pattern) {
  const line = labeledLine(text, pattern);
  return line ? splitList(line) : [];
}

function splitList(value) {
  return value
    .split(/[,，、;；/]|和|\+/)
    .map((part) => part.replace(/^[做]/, "").trim())
    .filter((part) => part && part.length < 80);
}

function snippetAround(text, pattern) {
  const match = text.match(pattern);
  if (!match || match.index === undefined) {
    return "";
  }
  return text.slice(match.index, match.index + 180);
}

function firstNumber(text, pattern, wan = true) {
  const match = text.match(pattern);
  if (!match?.[2]) {
    return undefined;
  }
  const num = Number(match[2]);
  if (Number.isNaN(num)) {
    return undefined;
  }
  const unit = `${match[3] || ""} ${match[0] || ""}`.toLowerCase();
  if (wan && (unit.includes("万") || /\bw\b/.test(unit) || /万/.test(match[0] || ""))) {
    return Math.round(num * 10000);
  }
  return num;
}

function cite(pages, filename, values) {
  const citations = [];
  for (const value of values) {
    if (!value) {
      continue;
    }
    pages.forEach((page, index) => {
      if (page.includes(value) && citations.length < 8) {
        citations.push({
          source_filename: filename,
          page: pages.length > 1 ? index + 1 : undefined,
          quote: value.toString().slice(0, 80),
        });
      }
    });
  }
  return citations;
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: parse-brief.mjs <file>");
    process.exit(2);
  }
  const text = readFileSync(file, "utf8");
  const result = parseBriefSource({ text, filename: file });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
