---
name: brief-parse
description: >
  把客户 Brief（PPT/PDF/纪要/纯文本）解析成结构化 Brief 对象并写入战役产物版本。
  在线程出现 Brief 文件，或 AE 要确认「这就是客户要的」时使用。
license: MIT
metadata:
  version: "1.0"
  owner: campaign-agent
---

# brief-parse

## When to use

- 线程里出现客户 Brief 文件（PDF / 文本 / 纪要）。
- AE 说「先看这个 Brief」或要求结构化「客户要的是什么」。
- 不要在策划、选人、写脚本时使用本 Skill。

## Do

- 只写出系统对象 `Brief`（目标、KPI、预算带、平台、必选/禁选、卖点、ban claims、时间锚点）。
- 源文里有的字段才填。citations 尽量带页码或原文片段。
- 缺预算带或 KPI 时写入 `open_questions`（`assignee_role: AE`，`blocking: true`），Brief 仍落库为新版本。
- 运行捆绑脚本 `scripts/parse-brief.mjs` 做抽取，不要靠「感觉」补数字。

## Don't

- 不写 `strategy_idea`，不点名达人名单，不拆预算执行表，不给客户写回信。
- **禁止编造预算金额、KPI、粉丝数、刊例。** 没有就问，不要用行业默认值填上。
- 不把聊天原文当成 Brief 真相；写出的对象必须带 `version_id`。
- 不加载、不调用达人库 / 报价 / 发帖类 MCP。

## Inputs / Outputs

- **Input:** 源文件字节或纯文本；战役 `campaign_id`；租户 `tenant_id`。
- **Output:** `Brief` 对象 `{ object_id, version, version_id, payload, open_questions[], citations[] }`。
- 战役记忆必须 pin `parsed_brief → (object_id, version)`。线程卡片只是投影。

## Bundled files

- `scripts/parse-brief.mjs` — 确定性抽取器（本切片演示路径真正执行的脚本）。
- `references/brief-schema.md` — 字段说明；命中本 Skill 后再读。
