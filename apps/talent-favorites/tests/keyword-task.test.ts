import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parseKeywords,
  validateKeywordTask,
} from "../public/keyword-task.js";

const root = path.dirname(fileURLToPath(import.meta.url));

describe("validateKeywordTask", () => {
  const valid = {
    name: "高洁丝霸屏监控任务",
    brandId: "kotex",
    lineId: "卫生巾",
    keywordsText: "纯棉卫生巾\n敏感肌经期",
    noteCount: 30,
    cycle: "daily",
    durationDays: 7,
    sortBy: "综合",
    publishTime: "不限",
  };

  it("accepts a complete daily task", () => {
    const result = validateKeywordTask(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.keywords).toEqual(["纯棉卫生巾", "敏感肌经期"]);
      expect(result.value.cycle).toBe("daily");
      expect(result.value.durationDays).toBe(7);
    }
  });

  it("does not require 品线", () => {
    const result = validateKeywordTask({ ...valid, lineId: "" });
    expect(result.ok).toBe(true);
  });

  it("requires name, brand, keywords, note count, sort, and publish time", () => {
    const result = validateKeywordTask({
      name: "",
      brandId: "",
      keywordsText: "",
      noteCount: "",
      cycle: "once",
      sortBy: "",
      publishTime: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(
        ["brandId", "keywordsText", "name", "noteCount", "publishTime", "sortBy"].sort(),
      );
    }
  });

  it("rejects names over 50 characters", () => {
    const result = validateKeywordTask({ ...valid, name: "测".repeat(51) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.name).toMatch(/50/);
  });

  it("rejects keywords that contain links", () => {
    const result = validateKeywordTask({
      ...valid,
      keywordsText: "纯棉卫生巾\nhttps://www.xiaohongshu.com/note/1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.keywordsText).toMatch(/链接/);
  });

  it("parses Chinese commas as keyword separators", () => {
    expect(parseKeywords("纯棉卫生巾，敏感肌经期")).toEqual(["纯棉卫生巾", "敏感肌经期"]);
  });

  it("requires duration days only for 日更新", () => {
    const once = validateKeywordTask({ ...valid, cycle: "once", durationDays: "" });
    expect(once.ok).toBe(true);
    const daily = validateKeywordTask({ ...valid, cycle: "daily", durationDays: "" });
    expect(daily.ok).toBe(false);
    if (!daily.ok) expect(daily.errors.durationDays).toBeTruthy();
  });
});

describe("收藏夹 page markup", () => {
  it("puts 关键词找号 under the 母婴 tab and omits 任务类型", async () => {
    const html = await readFile(path.join(root, "../public/index.html"), "utf8");
    expect(html).toContain("母婴");
    expect(html).toContain("关键词找号");
    expect(html).toContain("创建监控任务");
    expect(html).toContain("任务名称");
    expect(html).toContain("监控关键词");
    expect(html).toContain("采集笔记数量");
    expect(html).toContain("只监控1次");
    expect(html).toContain("日更新");
    expect(html).toContain("持续更新");
    expect(html).toContain("08:00");
    expect(html).toContain("排序依据");
    expect(html).toContain("发布时间");
    expect(html).not.toContain("任务类型");
    expect(html).not.toContain("搜索热帖监控");
    expect(html).not.toContain("行业热帖监控");
    expect(html).not.toContain("SEO监控");

    const muyingIdx = html.indexOf("母婴");
    const btnIdx = html.indexOf("关键词找号");
    expect(muyingIdx).toBeGreaterThan(-1);
    expect(btnIdx).toBeGreaterThan(muyingIdx);
  });
});
