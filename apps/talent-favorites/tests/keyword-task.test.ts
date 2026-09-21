import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parseKeywords,
  validateKeywordTask,
} from "../public/keyword-task.js";

async function pageHtml() {
  return readFile(path.join(root, "../public/index.html"), "utf8");
}

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

  it("allows empty note like and pgy ranges", () => {
    const result = validateKeywordTask(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.noteFilters.likeCount).toBeNull();
      expect(result.value.pgyFilters.fansCount).toBeNull();
      expect(result.value.pgyFilters.quote).toBeNull();
      expect(result.value.pgyFilters.cpe30d).toBeNull();
    }
  });

  it("keeps a closed like-count range on the task", () => {
    const result = validateKeywordTask({
      ...valid,
      noteLikeMin: "100",
      noteLikeMax: "5000",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.noteFilters.likeCount).toEqual({ min: 100, max: 5000 });
    }
  });

  it("rejects inverted like-count ranges", () => {
    const result = validateKeywordTask({
      ...valid,
      noteLikeMin: "900",
      noteLikeMax: "100",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.noteLikeRange).toMatch(/最小/);
  });

  it("rejects inverted pgy ranges and out-of-bound percents", () => {
    const inverted = validateKeywordTask({
      ...valid,
      pgyFansMin: "20000",
      pgyFansMax: "1000",
    });
    expect(inverted.ok).toBe(false);
    if (!inverted.ok) expect(inverted.errors.pgyFansRange).toBeTruthy();

    const percent = validateKeywordTask({
      ...valid,
      pgyInteractMin: "0",
      pgyInteractMax: "150",
    });
    expect(percent.ok).toBe(false);
    if (!percent.ok) expect(percent.errors.pgyInteractRange).toMatch(/100/);
  });
});

describe("收藏夹 page markup", () => {
  it("puts 关键词找号 under the 母婴 tab and omits 任务类型", async () => {
    const html = await pageHtml();
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

  it("shows 笔记数据筛选 like range and next-step meaning", async () => {
    const html = await pageHtml();
    const drawer = html.slice(html.indexOf("创建监控任务"));
    expect(drawer).toContain("笔记数据筛选");
    expect(drawer).toContain("点赞量");
    expect(drawer).toContain('name="noteLikeMin"');
    expect(drawer).toContain('name="noteLikeMax"');
    expect(drawer).toMatch(/仅点赞量落在该区间内的笔记会进入下一步/);
  });

  it("groups compact 蒲公英 range filters and collapses the rest", async () => {
    const html = await pageHtml();
    const drawer = html.slice(html.indexOf("创建监控任务"));
    expect(drawer).toContain("蒲公英数据筛选");
    expect(drawer).toContain("达人基础信息");
    expect(drawer).toContain("达人粉丝");
    expect(drawer).toContain("达人商单数据");
    expect(drawer).toContain("达人日常笔记数据");
    expect(drawer).toContain("达人粉丝数");
    expect(drawer).toContain("报价");
    expect(drawer).toContain("近30天全流量商单 CPE");
    expect(drawer).toContain("曝光");
    expect(drawer).toContain("阅读");
    expect(drawer).toContain("互动率");
    expect(drawer).toContain("完播率");
    expect(drawer).toContain("更多筛选");
    expect(drawer).toMatch(/id="pgy-more-filters"[^>]*class="[^"]*fav-hidden/);
    expect(drawer).not.toContain("曝光来源-搜索");
    expect(drawer).not.toContain("阅读来源-个人");
    const drawerCheckboxes = drawer.match(/a3-checkbox-input/g) ?? [];
    expect(drawerCheckboxes.length).toBe(0);
  });
});
