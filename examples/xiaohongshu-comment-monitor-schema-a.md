# 小红书笔记评论监控 — 方案 A：评论实体 + 每日排序快照

> 适用场景：一批笔记链接，连续监控约 7 天，每天更新一次评论；需要与界面看到的顺序一致；评论可能新增、消失、重排；最新日要清晰，历史不能丢。

---

## 1. 设计目标

| 目标 | 说明 |
|------|------|
| 界面态 | 任意一天都能还原「当天页面上评论的顺序」 |
| 审计态 | 曾出现过的评论不因次日抓不到而物理删除 |
| 最新优先 | 默认列表 = 最近一次成功抓取的有序结果 |
| 可对比 | 能回答：今日新增 / 今日消失 / 相对昨日重排 |

**原则：不覆盖写「唯一评论列表」；排序存在「每次抓取」上，评论身份存在「实体表」上。**

---

## 2. 概念模型

```
Note（笔记）
  └── MonitorRun（某日一次抓取）
        └── CommentRunItem（当日有序列表项：position + comment）
              └── Comment（评论实体，跨天复用）
                    └── CommentVersion（可选：正文/点赞等变更）
```

- **Comment**：谁说了什么（身份稳定，跨天同一条）。
- **MonitorRun + CommentRunItem**：某天界面上第几名是谁（保序快照）。
- 某评论「消失」= 昨天的 Run 里有、今天的 Run 里没有；行仍留在 `comments`。

---

## 3. 表结构

### 3.1 `notes` — 被监控笔记

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGINT PK | 内部主键 |
| `platform` | VARCHAR | 如 `xiaohongshu` |
| `platform_note_id` | VARCHAR | 平台笔记 ID |
| `note_url` | TEXT | 原始链接 |
| `title` | VARCHAR NULL | 可选缓存 |
| `monitor_start_date` | DATE | 监控开始日 |
| `monitor_end_date` | DATE | 计划结束日（如 +6 天） |
| `status` | VARCHAR | `active` / `paused` / `done` |
| `created_at` / `updated_at` | TIMESTAMP | |

约束：`UNIQUE(platform, platform_note_id)`

---

### 3.2 `monitor_runs` — 某笔记某日一次抓取

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGINT PK | |
| `note_id` | BIGINT FK → notes | |
| `crawl_date` | DATE | 业务日（按监控时区，建议 Asia/Shanghai） |
| `status` | VARCHAR | `pending` / `success` / `partial` / `failed` |
| `sort_mode` | VARCHAR | 抓取时排序：如 `hot` / `time`（与 App 一致则记下） |
| `fetched_count` | INT | 当日实际写入条数 |
| `error_message` | TEXT NULL | |
| `started_at` / `finished_at` | TIMESTAMP | |
| `created_at` | TIMESTAMP | |

约束：`UNIQUE(note_id, crawl_date)`  
说明：一天一次；若同日重跑，建议新开 run 或显式覆盖策略（见 §5）。

---

### 3.3 `comments` — 评论实体（跨天）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGINT PK | |
| `note_id` | BIGINT FK → notes | |
| `platform_comment_id` | VARCHAR | **平台评论 ID，身份主键** |
| `author_id` | VARCHAR NULL | |
| `author_name` | VARCHAR NULL | |
| `content` | TEXT | 最近一次见到的正文 |
| `like_count` | INT NULL | 最近一次见到的点赞 |
| `comment_created_at` | TIMESTAMP NULL | 平台侧创建时间 |
| `first_seen_at` | TIMESTAMP | 首次被**成功/部分成功** Run 收录的时间 |
| `last_seen_at` | TIMESTAMP | 最近一次出现在成功/部分成功 Run |
| `first_seen_run_id` | BIGINT FK → monitor_runs | 仅指向 success/partial；失败 run 不得占用 |
| `last_seen_run_id` | BIGINT FK → monitor_runs | 同上 |
| `created_at` / `updated_at` | TIMESTAMP | |

约束：`UNIQUE(note_id, platform_comment_id)`  
**禁止**因「今日未抓到」而 DELETE。

---

### 3.4 `comment_run_items` — 当日有序列表（核心）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGINT PK | 可选 |
| `run_id` | BIGINT FK → monitor_runs | |
| `comment_id` | BIGINT FK → comments | |
| `position` | INT | **1-based，与接口/界面返回顺序一致** |
| `like_count` | INT NULL | 当日快照点赞（可选，避免和实体最新值混淆） |
| `content_snapshot` | TEXT NULL | 当日正文快照（可选；或走 comment_versions） |

约束：

- `UNIQUE(run_id, position)`
- `UNIQUE(run_id, comment_id)`

索引建议：`(run_id, position)`、`(comment_id, run_id)`。

---

### 3.5 `comment_versions` — 可选：字段变更史

当同一 `platform_comment_id` 的正文或点赞相对上次有变化时插入一行。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGINT PK | |
| `comment_id` | BIGINT FK | |
| `run_id` | BIGINT FK | 在哪次抓取发现变更 |
| `content` | TEXT | |
| `like_count` | INT NULL | |
| `observed_at` | TIMESTAMP | |

7 天监控、且只关心顺序与存亡时，**可暂不建此表**；需要「点赞曲线 / 改口」时再加。

---

## 4. DDL 示例（PostgreSQL）

```sql
CREATE TABLE notes (
  id                BIGSERIAL PRIMARY KEY,
  platform          VARCHAR(32)  NOT NULL DEFAULT 'xiaohongshu',
  platform_note_id  VARCHAR(64)  NOT NULL,
  note_url          TEXT         NOT NULL,
  title             VARCHAR(512),
  monitor_start_date DATE        NOT NULL,
  monitor_end_date   DATE        NOT NULL,
  status            VARCHAR(16)  NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (platform, platform_note_id)
);

CREATE TABLE monitor_runs (
  id             BIGSERIAL PRIMARY KEY,
  note_id        BIGINT       NOT NULL REFERENCES notes(id),
  crawl_date     DATE         NOT NULL,
  status         VARCHAR(16)  NOT NULL DEFAULT 'pending',
  sort_mode      VARCHAR(32),
  fetched_count  INT          NOT NULL DEFAULT 0,
  error_message  TEXT,
  started_at     TIMESTAMPTZ,
  finished_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (note_id, crawl_date)
);

CREATE TABLE comments (
  id                   BIGSERIAL PRIMARY KEY,
  note_id              BIGINT       NOT NULL REFERENCES notes(id),
  platform_comment_id  VARCHAR(64)  NOT NULL,
  author_id            VARCHAR(64),
  author_name          VARCHAR(256),
  content              TEXT         NOT NULL DEFAULT '',
  like_count           INT,
  comment_created_at   TIMESTAMPTZ,
  first_seen_at        TIMESTAMPTZ  NOT NULL,
  last_seen_at         TIMESTAMPTZ  NOT NULL,
  first_seen_run_id    BIGINT       REFERENCES monitor_runs(id),
  last_seen_run_id     BIGINT       REFERENCES monitor_runs(id),
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (note_id, platform_comment_id)
);

CREATE TABLE comment_run_items (
  id               BIGSERIAL PRIMARY KEY,
  run_id           BIGINT NOT NULL REFERENCES monitor_runs(id) ON DELETE CASCADE,
  comment_id       BIGINT NOT NULL REFERENCES comments(id),
  position         INT    NOT NULL CHECK (position >= 1),
  like_count       INT,
  content_snapshot TEXT,
  UNIQUE (run_id, position),
  UNIQUE (run_id, comment_id)
);

CREATE INDEX idx_comment_run_items_run_pos ON comment_run_items (run_id, position);
CREATE INDEX idx_comments_note_last_seen ON comments (note_id, last_seen_at);
CREATE INDEX idx_monitor_runs_note_date ON monitor_runs (note_id, crawl_date DESC);
```

---

## 5. 每日写入流程

对每个 `status = active` 且在监控窗口内的 `note`：

1. **创建 Run**  
   `INSERT monitor_runs(note_id, crawl_date, status='pending', sort_mode=...)`  
   若 `(note_id, crawl_date)` 已存在且允许重跑：删除该 run 下 `comment_run_items` 后重写，或新建 run 并废弃旧 run（二选一，团队定死一种）。

2. **按接口返回顺序遍历**（禁止事后按点赞/时间重排）  
   对第 `i` 条（`i` 从 1 开始）：
   - Upsert `comments` 的**内容字段**（`content` / `like_count` / author 等）。  
     **不要在循环里写死 `first_seen_run_id` / `last_seen_run_id`**（见下条收尾）；新评论可先插入实体，`first_seen_*` 留空或暂记，以收尾为准。
   - Insert `comment_run_items(run_id, comment_id, position=i, ...)`。

3. **收尾（成功 / 部分成功才「生效」）**  
   - `UPDATE monitor_runs SET status='success'|'partial', fetched_count=N, finished_at=now()`  
   - 对本 run 的每条 `comment_run_items`：  
     - 若 `comments.first_seen_run_id` 为空，或指向的 run 不是 `success`/`partial`，则设为**本 run**  
     - 一律更新 `last_seen_run_id` / `last_seen_at` 为本 run  
   - 这样失败 run 不会抢走「首次见到」的归属，也不会让次日成功抓取丢「新增」标记。

4. **失败回滚**  
   - `status='failed'` 时：删除该 run 的 `comment_run_items`；**不**把任何 comment 的 `first_seen_*` / `last_seen_*` 指到该 run。  
   - 对比「上一成功日」时跳过 failed run。

5. **消失评论**  
   不做实体 DELETE。展示层用「上一成功 Run 有 ∩ 本成功 Run 无」推导。

### 伪代码

```text
run = create_run(note_id, today, sort_mode)

try:
  for position, raw in enumerate(api_comments_in_ui_order, start=1):
      comment = upsert_comment_content(note_id, raw)   # 不写 first/last_seen_run
      insert_run_item(run.id, comment.id, position, snapshot=raw)
  finalize_run_success(run)  # 标记 success/partial，再批量回填 first/last_seen_*
except:
  mark_run_failed(run)
  delete_run_items(run.id)   # 失败 run 不留排序快照，不污染 first_seen
```

### 「今日新增」判定（与 first_seen 解耦）

UI 上的「今日新增」**不要**用 `first_seen_run_id = 最新 run`。  
应与「今日消失」对称，用**两次成功 Run 的集合差**：

- 今日新增 = 在最新成功 Run 有，且不在上一成功 Run  
- 今日消失 = 在上一成功 Run 有，且不在最新成功 Run  

`first_seen_*` 仍保留，用于审计「系统最早在哪次成功抓取见到」，不直接当 UI 日更标签。

### 身份键

- **优先**：平台 `comment_id`。
- **兜底**（无稳定 ID 时）：`hash(author_id + content + comment_created_at)`，并接受偶发碰撞；写入文档与监控告警。

---

## 6. 常用查询

### 6.1 最新一天界面顺序（默认列表）

```sql
WITH latest AS (
  SELECT id
  FROM monitor_runs
  WHERE note_id = :note_id AND status IN ('success', 'partial')
  ORDER BY crawl_date DESC, id DESC
  LIMIT 1
)
SELECT i.position, c.*
FROM comment_run_items i
JOIN comments c ON c.id = i.comment_id
JOIN latest l ON l.id = i.run_id
ORDER BY i.position;
```

### 6.2 指定某日回放

```sql
SELECT i.position, c.*
FROM monitor_runs r
JOIN comment_run_items i ON i.run_id = r.id
JOIN comments c ON c.id = i.comment_id
WHERE r.note_id = :note_id
  AND r.crawl_date = :crawl_date
  AND r.status IN ('success', 'partial')
ORDER BY i.position;
```

### 6.3 今日新增（相对上一成功日，集合差）

```sql
-- :latest_run_id / :prev_run_id 均为 success|partial；无上一成功日则全部算新增
SELECT c.*
FROM comment_run_items cur
JOIN comments c ON c.id = cur.comment_id
WHERE cur.run_id = :latest_run_id
  AND NOT EXISTS (
    SELECT 1 FROM comment_run_items prev
    WHERE prev.run_id = :prev_run_id
      AND prev.comment_id = cur.comment_id
  );
```

> 不要用 `first_seen_run_id = :latest_run_id`：失败 run 若曾写入实体，会让次日成功抓取再也打不上「新增」。

### 6.4 今日消失（相对上一成功日）

```sql
SELECT c.*
FROM comment_run_items prev
JOIN comments c ON c.id = prev.comment_id
WHERE prev.run_id = :prev_run_id
  AND NOT EXISTS (
    SELECT 1 FROM comment_run_items cur
    WHERE cur.run_id = :latest_run_id
      AND cur.comment_id = prev.comment_id
  );
```

### 6.5 相对昨日重排

```sql
SELECT
  c.id,
  cur.position  AS position_today,
  prev.position AS position_yesterday,
  (prev.position - cur.position) AS rank_delta  -- 正数表示上升
FROM comment_run_items cur
JOIN comment_run_items prev
  ON prev.comment_id = cur.comment_id
 AND prev.run_id = :prev_run_id
JOIN comments c ON c.id = cur.comment_id
WHERE cur.run_id = :latest_run_id
  AND cur.position IS DISTINCT FROM prev.position
ORDER BY cur.position;
```

### 6.6 单条评论生命周期

```sql
SELECT r.crawl_date, i.position, i.like_count
FROM comment_run_items i
JOIN monitor_runs r ON r.id = i.run_id
WHERE i.comment_id = :comment_id
  AND r.status IN ('success', 'partial')
ORDER BY r.crawl_date;
```

---

## 7. 展示设计

### 7.1 默认视图：最新一天（主路径）

- 严格按最新 Run 的 `position` 渲染，与 App 一致。
- 行内轻量标签（可选）：
  - `新增`：在最新成功 Run，且不在上一成功 Run（集合差，见 §6.3）
  - `↑` / `↓`：相对上一成功日 `position` 变化
- 顶部摘要一行即可：  
  `今日 128 条 · 新增 12 · 消失 5 · 重排 23`

**不要把「已消失」插回主列表**——会破坏「与界面一致」的目标。

### 7.2 次级：变更

独立 Tab / 面板，三块即可：

1. 新增  
2. 消失（文案建议：**当日未抓到 / 已不可见**，勿武断写「已删除」）  
3. 重排（昨日 position → 今日 position）

### 7.3 次级：历史回放

- 日期切换 Day1–Day7（或 `crawl_date` 选择器）  
- 按该日 Run 的 `position` 渲染  
- 可与「最新」并排 Diff（进阶）

### 7.4 单条评论抽屉

- 首次出现日、最后出现日  
- 各日排名折线或列表  
- 若有 `comment_versions`：正文/点赞变更点

---

## 8. 状态机（推导，可不落库）

| 展示状态 | 判定 |
|----------|------|
| 今日可见 | 存在于最新成功 Run 的 `comment_run_items` |
| 今日新增 | 最新成功 Run 有，且上一成功 Run 无（集合差） |
| 今日消失 | 上一成功 Run 有，且最新成功 Run 无 |
| 历史曾现 | 在 `comments` 中，但不在最新成功 Run |
| 持续可见 | 最新与上一成功 Run 均有（可再比 position） |

`first_seen_run_id` 仅表示「首次被某次**成功/部分成功**抓取收录」，**不**作为日更「新增」标签的唯一依据。

可选物化：每日跑批写入 `comment_daily_flags(note_id, crawl_date, comment_id, is_new, is_missing, ...)`；早期用查询推导即可。

---

## 9. 边界与约定

1. **排序以抓取返回顺序为准**；`monitor_runs.sort_mode` 记录当时模式（热门/最新等）。  
2. **时区**：`crawl_date` 用业务时区（如 Asia/Shanghai）的日历日，避免 UTC 切日错位。  
3. **部分成功**：`status=partial` 仍可作「当日界面近似」，UI 标注「未抓全」。  
4. **失败日**：清空该 run 的 `comment_run_items`；不把 `first_seen_*` / `last_seen_*` 指到失败 run；「上一成功日」跳过失败 run。日更「新增/消失」一律用两次成功 Run 的集合差，避免失败污染。  
5. **二级评论**：本方案默认一级；若要楼中楼，另加 `parent_comment_id` + 同 run 内子序，或独立 `reply_run_items`。  
6. **保留周期**：监控结束后可继续保留 7 日快照；归档策略与产品另行约定。  
7. **合规**：仅存业务所需字段；导出/展示注意脱敏与平台 ToS。

---

## 10. 数据量粗估（量级感）

假设：100 条笔记 × 7 天 × 每帖 200 条一级评论。

| 表 | 量级 |
|----|------|
| `monitor_runs` | ~700 行 |
| `comment_run_items` | ~14 万行 |
| `comments` | ≤ 14 万（有重复出现则更少） |

常规索引下查询压力很小；瓶颈通常在抓取配额与限流，不在这套表。

---

## 11. 验收清单

- [ ] 最新列表顺序与当日抓取原始顺序一致（抽检 position）  
- [ ] 昨日有、今日无的评论仍可在「消失/历史」中查到  
- [ ] 今日新评论标记正确（相对上一成功 Run 的集合差），且出现在最新列表对应 position  
- [ ] 任意历史成功 `crawl_date` 可回放当日顺序  
- [ ] 同日重跑策略明确且不产生重复 position  
- [ ] 失败日清空 items、不占用 first/last_seen，且不污染「上一成功日」对比与「今日新增」  

---

## 12. 方案一句话

**评论身份进 `comments`，每天的界面顺序进 `comment_run_items`；默认看最新 Run，历史靠 Run 回放，消失只推导不删除。**
