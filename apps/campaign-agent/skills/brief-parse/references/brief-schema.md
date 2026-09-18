# Brief object (slice 1)

System object written by `brief-parse`. Field values must come from the source. Missing budget or KPI become `open_questions`; they are never defaulted.

| Field | Rule |
|---|---|
| `objective` | 种草 / 转化 / 上市 / 危机修复, or null |
| `kpis` | Empty array if the source has no KPI. Do not invent 完播 / 在看 / CPA. |
| `budget_band` | Null if no budget language. Amounts only if numbers appear in source. |
| `platforms_include` / `platforms_exclude` | From 平台 / 必选 / 不做直播 etc. |
| `talents_must_include` / `talents_must_exclude` | Constraints only, not a shortlist. |
| `selling_points` / `ban_claims` | Claims and forbidden claims. |
| `time_anchors` | Launch dates, 大促, review meetings. |

`open_questions[]` item: `{ id, assignee_role, field, question, blocking }`.
Budget / KPI questions assign to AE and are blocking.
