# Proposal object (slice 3)

System object written by `plan-proposal`. Values come from the pinned Brief version. Missing strategy or unmatched budget become `open_questions`; they are never defaulted from industry norms.

| Field | Rule |
|---|---|
| `insight` | One short read of the Brief. Null if there is nothing to rest on. |
| `strategy_idea` | Required one-liner. Empty → blocking question, gate stays `blocked`. Never invent a slogan from outside the Brief. |
| `comm_idea` | Optional communication line derived from selling points / ban claims. Null if none. |
| `audience` | Only if Brief states who. Do not invent a 人群包. |
| `platform_play[]` | Platform × format × role from Brief `platforms_include` / `platforms_exclude` and objective. |
| `budget_split` | Copy Brief `budget_band` numbers only. `matches_brief_band` must be true when amounts exist. Null if Brief has no band. |
| `phasing` | From Brief `time_anchors`. Empty if none; do not invent dates. |
| `pages[]` | Outline structure (cover / insight / strategy / …). Not a 20-page dump of invented copy. |
| `sample_content_hooks[]` | Hooks for the content worker, not scripts, not ContentPack. |
| `source_brief_version_id` | Pin of the Brief version this draft read. Downstream must not silently switch to "latest". |

`open_questions[]` item: `{ id, assignee_role, field, question, blocking }`.
Missing `strategy_idea` assigns to planner. Budget mismatch assigns to AE. Both blocking.

This object is `drafting` until a human freezes it. This skill does not write `frozen_strategy` and does not ingest into KB.
