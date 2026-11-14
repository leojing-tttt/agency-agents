# 产品需求 · 后端交接契约

| 项 | 内容 |
|----|------|
| 产品 | A3 SaaS · 竞品投放监控 |
| 文档状态 | 与当前 Demo 对齐（前端 mock；供后端实现） |
| 受众 | 后端、前端对接、测试 |

> 本 Demo **不实现**调度与抓取。下列为产品侧约定，供后端落地与联调。

---

## 1. 核心对象

### CompetitorMonitor（竞品监控任务）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| brand | string | 竞品品牌名 |
| keywords | string[] | 品牌词，≥1 |
| frequency | `weekly` \| `biweekly` | 抓取频次 |
| limit_per_keyword | int | 每个品牌词单次上限，建议 10–500 |
| tier_bottom_max | int | 底部上限（不含）：fans &lt; 此值 |
| tier_mid_max | int | 中腰上限（不含）：fans &lt; 此值；≥ 为头部 |
| enabled | bool | 是否调度 |
| platform | const `xiaohongshu` | MVP 固定 |
| sort | const `time_descending` | MVP 固定时间排序 |
| status | enum | `idle` / `running` / `updated` / `failed` / `paused` |
| last_run_at | datetime? | 上次调度结束 |
| last_success_at | datetime? | 上次成功 |
| note_count | int | 去重笔记数（展示用可缓存） |
| created_by / tenant_id | — | 按 A3 多租户模型 |

### Note（笔记）

| 字段 | 类型 | 说明 |
|------|------|------|
| note_id | string | 平台笔记 ID，去重键 |
| competitor_id | string | 归属任务 |
| title / desc | string | 标题 / 正文 |
| author_name | string | 作者昵称 |
| author_id | string? | 作者 ID |
| fans_count | int | 粉丝数（抓取时快照） |
| liked_count / collected_count / comment_count | int | 互动 |
| published_at | datetime | 笔记发布时间 |
| matched_keywords | string[] | 命中的品牌词 |
| crawled_at | datetime | 入库时间 |
| batch_id | string | 所属抓取批次 |

### CrawlBatch（批次）

| 字段 | 说明 |
|------|------|
| id | 批次 ID |
| competitor_id | 任务 |
| started_at / finished_at | 时间 |
| status | success / partial / failed |
| note_count | 本批新增或 upsert 数 |
| engagement_sum | 本批笔记互动合计 |
| error_message | 失败信息 |

---

## 2. 调度规则

1. 仅 `enabled=true` 且状态非人工暂停的任务入队。
2. `weekly`：距 `last_success_at`（或创建时间）≥ 7 天触发；`biweekly` ≥ 14 天。
3. 每个 `keyword` 独立请求搜帖，`limit_per_keyword` 为停止上限；共同去重规则见数据源能力。
4. 排序：时间倒序；不在本 MVP 暴露其他 sort UI。
5. Upsert：同一 `note_id` 更新互动与粉丝快照，保留首次 `crawled_at`。
6. 分层不落死标签也可：读时用任务当前 `tier_*` 计算（改阈值立即生效）。

---

## 3. 聚合 API（建议）

供详情看板：

| 接口意图 | 返回 |
|----------|------|
| GET 任务详情 | 配置 + 摘要计数 |
| GET 批次走势 | `[{ date, note_count, engagement }]` |
| GET 分层分布 | `{ bottom, mid, top }` 篇数 |
| GET 词云 | `[{ term, weight }]`（后端分词） |
| GET 笔记分页 | 表字段 + 计算后的 tier |

写接口：创建/更新/删除任务；可选「立即跑一次」（权限另定）。

---

## 4. 数据源假设

- 小红书关键词搜帖（如 TikHub `xiaohongshu` + `time_descending`）。
- 费用与 QPS 由后端按 `limit_per_keyword × keywords.length` 估算并做租户配额。
- 抓取失败：任务 `status=failed`，详情可展示最近错误；不删历史笔记。

---

## 5. 前端 Demo 对应关系

| Demo 字段 | 契约字段 |
|-----------|----------|
| limitPerKeyword | limit_per_keyword |
| tierBottomMax | tier_bottom_max |
| tierMidMax | tier_mid_max |
| frequency | frequency |
| notes[].liked 等 | liked_count 等 |

---

## 6. 验收（后端）

| # | 条件 |
|---|------|
| 1 | 创建任务后能按频次产生 batch |
| 2 | 多 keyword 去重正确 |
| 3 | 改 tier 后分布接口变化、无需重爬 |
| 4 | 停用后不再产生新 batch |
