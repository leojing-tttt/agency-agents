# 产品需求 · MCP 工具观测台

| 项 | 内容 |
|----|------|
| 产品 | MCP 工具观测台 |
| 文档状态 | 与当前 Demo 对齐 |
| 受众 | 产品、研发、测试、AI |
| Demo | `apps/mcp-tool-observatory-demo/` · `http://localhost:5188/` |

---

## 1. 问题与目标

**问题：** 用户自建 MCP（业务 API 以 tools 暴露给 Agent）时，平台缺少统一视图回答：调了哪些 tool、谁调的、从哪家客户端、成没成、耗时多少。

**目标：**
1. 提供平台管理员向的「网关请求台」（方案 A）：总览 KPI → 调用流水 → 详情抽屉 → 工具档案。
2. 一行 = 一次 `tools/call`；列必须含 **谁** + **哪工具**（+ 平台、状态、时间、延迟）。
3. Demo 可切换「我的调用」用户 stub（更轻页面）；默认管理员台。
4. 不接真实 MCP 后端；不做 Trace 树（方案 B out of scope）。

---

## 2. 角色与权限

| 角色 | 能力 |
|------|------|
| 平台管理员（默认） | 总览 / 流水全量筛选 / 工具档案；环境切换 |
| 终端用户（stub） | 仅「我的调用」：当前演示用户相关行 + 详情 |

---

## 3. 信息架构

```
MCP 工具观测台
├── [顶栏] 产品文档 | 视图(管理员/我的调用) | 环境 | 身份芯片
├── 总览          ← KPI：调用数、错误率、P95、活跃工具；平台分布；错误 Top；异常抽样
├── 调用流水      ← 筛选 + 表 + 分页 + 行详情抽屉
├── 工具档案      ← 工具 / 中文名 / 创建人 / 最后调用；点「查看流水」带 tool 筛到流水
└── 我的调用      ← 用户 stub（顶栏切换后侧栏仅此项）
```

无「设置」页；`#settings` 重定向到总览。

---

## 4. 界面清单与验收

| # | 界面 | 谁用 | 必须行为 |
|---|------|------|----------|
| 1 | 总览 | 管理员 | 时间窗切换；KPI（含公式 ?）；平台条；点错误工具跳流水 |
| 2 | 调用流水 | 管理员 | 筛工具/平台/状态/调用方/时间；点行开抽屉 |
| 3 | 调用详情抽屉 | 双方 | 展示**完整** arguments / result JSON、IDs、耗时；可复制 event_id |
| 4 | 工具档案 | 管理员 | 表列：工具、中文名、工具创建人、最后调用、操作；下钻到流水 |
| 5 | 我的调用 | 用户 stub | 仅本人行；无平台级筛选 |
| 6 | 产品文档 | 任何人 | 顶栏预览/下载 `docs/*.md` |

---

## 5. 总览 KPI 计算公式（给 AI / 研发）

**范围（所有 KPI 共用）：** `当前顶栏环境` ∩ `总览时间窗`（近 24h / 7d / 30d，相对 mock 最新事件时间）。  
事件粒度：一行 = 一次 `tools/call`。

| KPI | 公式 |
|-----|------|
| **调用数** | `count(events in range)` — 选定范围内 tools/call 事件条数 |
| **错误率** | `failed / total × 100%`；`failed` = `status ∈ {error, timeout}`；`total` = 调用数；`total=0` 时显示 `0%`（`canceled` 不计入 failed） |
| **P95 延迟** | 选定范围内**全部**调用的 `duration_ms` 升序后，取第 95 百分位（实现：`ceil(0.95 × n)` 位，1-based 再转 0-based index） |
| **活跃工具** | 选定范围内至少有 1 次调用的 `distinct tool_name` 个数 |

UI：每个 KPI 标签旁有 `?` hover/popover，文案与上表一致（`app.js` → `KPI_FORMULAS`）。

---

## 6. 关键业务规则

1. **粒度：** 一行 = 一次 `tools/call`（非 Session / Trace）。
2. **谁：** Demo 用 `caller_label` + `caller_user_id` + `tenant` + `api_key_id`。
3. **Payload：** **Demo 默认展示完整参数/结果 JSON**（真实形态 mock，无掩码），便于评审；生产可另做脱敏/二次权限。
4. **session_id / trace_id：** 字段可空，UI 明示空；不做树。
5. **环境：** 顶栏 prod / staging / dev 过滤 mock。
6. **Mock：** 静态生成事件；刷新不请求网络。

---

## 7. 非目标

- Trace / Session 回放（方案 B）
- 设置页 / 可编辑配置台
- 真实 MCP Inspector 联调、OTel 导出、告警路由
- 成本 FinOps、LLM token 看板

---

## 8. Demo 与实现提示

| 项 | 说明 |
|----|------|
| 入口 | `index.html`；hash `#overview` `#calls` `#tools` `#my-calls` |
| 代码锚点 | `app.js` mock + 筛选 + `KPI_FORMULAS`；`a3-drawer` 详情；顶栏 `#docs-entry` |
| 样式 | `a3-components.css`（品牌 `#c9677d`）+ `styles.css`（`mo-hint`） |
| 给 AI | 下载本文件或 `prd-all.md` |

---

## 9. PM 已锁定决策

1. 受众：平台管理员台为主；用户自有日志为独立轻页 + 顶栏切换。
2. 粒度与列：谁 + 工具 + 平台 + 状态 + 时间 + 延迟；管理员可筛上述维度。
3. UI：A3 演示层（对齐 yecai-workhour-demo）；顶栏「产品文档」。
