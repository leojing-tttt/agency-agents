---
name: plan-proposal
description: >
  根据本场已钉住的 Brief 版本写出策划方案（Proposal）对象并写入战役产物版本。
  在 Brief 已解析、或 AE/策划说「出方案 / 定主张」时使用。
license: MIT
metadata:
  version: "1.0"
  owner: campaign-agent
---

# plan-proposal

## When to use

- 本场已有钉住的 Brief 版本，线程要出方案大纲 / 策略主张。
- AE 或策划说「出方案」「定主张」「策划看一下」。
- 不要在解析 Brief、选人、写脚本时使用本 Skill。

## Do

- 只写出系统对象 `Proposal`（insight、strategy_idea、comm_idea、audience、platform_play、budget_split、phasing、pages、sample_content_hooks）。
- 输入只有本场记忆索引钉住的 Brief 版本。主张、预算拆分、钩子都引用该 `version_id`。
- 必须先有一句 `strategy_idea`。没有主张就写入 `open_questions`（`assignee_role: planner`，`blocking: true`），不准出空转页。
- 预算拆分必须对得上 Brief 预算带：只抄来源数字。对不上就问，禁止四舍五入或拆备用金糊弄。
- 内容示例只出 `sample_content_hooks`，不是成稿、不是 ContentPack。
- 运行捆绑脚本 `scripts/draft-proposal.mjs` 做确定性起草。

## Don't

- 不锁达人名单，不把 Brief 约束写成提报行，不写最终脚本 / 分镜 / ContentPack。
- 不写客户合同价、不加价、不编造粉丝/刊例/档期。
- **禁止编造预算金额、KPI、受众包、未出现在 Brief 里的卖点。** 没有就问。
- 不把聊天原文当成方案真相；写出的对象必须带 `version_id`。
- 不自动把方案写入知识库；KB 只检索已挂集合，聊天和草稿都不入库。
- 不调用达人库 / 报价 / 发帖类 MCP；不冻结主张（冻结是人在确认卡上点的，本 Skill 只出 drafting 版本）。

## Inputs / Outputs

- **Input:** 本场钉住的 `Brief` `{ object_id, version, version_id, payload }`；可选策划方向文本；战役 `campaign_id`；租户 `tenant_id`。
- **Output:** `Proposal` 对象 `{ object_id, version, version_id, payload, open_questions[], citations[] }`。
- 战役记忆必须 pin `drafted_proposal → (object_id, version)`。线程卡片只是投影。不要 pin `frozen_strategy`（那是闸门通过之后的事）。

## Bundled files

- `scripts/draft-proposal.mjs` — 确定性起草器（本切片演示路径真正执行的脚本）。
- `references/proposal-schema.md` — 字段说明；命中本 Skill 后再读。
