# Campaign Agent (slice 3)

Conversation is the product face. OpenClaw is the harness *loop*. Campaign contracts are ours.

This package lives in `apps/campaign-agent/` on purpose: the rest of this repository is still the upstream [agency-agents](https://github.com/msitarzewski/agency-agents) markdown roster. Do not put application code next to those `.md` specialists.

## How to run

```bash
cd apps/campaign-agent
npm install
npm test
npm run demo -- fixtures/briefs/complete.txt
npm run demo -- fixtures/briefs/missing-budget-kpi.txt
npm start
```

Then open http://127.0.0.1:4173 and drop a Brief `.txt` / `.pdf` into the thread.

A **complete** Brief auto-chains into `plan-proposal` on the same campaign thread (Brief card → Proposal card). You can also type `出方案` after a Brief is pinned. A blocked Brief (missing budget/KPI) does not invent a plan; say `出方案` to get a Proposal with `open_questions`.

`npm start` and `npm run demo` spawn a **per-tenant OpenClaw-compatible Gateway process** (WebSocket protocol v4). If that process cannot start or `hello-ok` never arrives, the app errors — it does not fake a successful turn.

Optional: run the Gateway yourself, then point the app at it:

```bash
npm run gateway -- --config /path/to/openclaw.json
```

Generate the sample PDF fixture (UTF-16BE content stream, readable by this slice’s extractor):

```bash
npm run demo -- --write-sample-pdf fixtures/briefs/complete.pdf
npm run demo -- fixtures/briefs/complete.pdf
```

## What this slice does

1. **OpenClaw harness loop** — isolated Gateway child per tenant. Session start snapshots skills (`skills.status`) and the per-agent MCP allowlist (`tools.effective`). Drop-Brief is `agent` + `agent.wait`. A follow-up plan turn reuses the same session.
2. **campaign-core** — versioned `Brief` and `Proposal` artifacts + campaign memory index that pins `(object_id, version)`. The thread stores projections (`artifact_ref`), not the object. Chat is not truth. Nothing is auto-written to KB.
3. **`brief-parse` + `plan-proposal` SKILL.md** — real Agent Skills bundles. Missing budget/KPI/strategy → `open_questions` (never invented). Proposal budget split copies the Brief band only.

Content cards stay gated: lock-row before any `ContentPack`. Until then the content worker only emits a wait message.

## Real vs stubbed

| Piece | Status |
|---|---|
| OpenClaw-compatible Gateway process (WS v4: `connect.challenge` → `connect` → `hello-ok`) | **Real** (local/dev runtime; one child per tenant) |
| Drop-Brief path: Gateway `agent` / `agent.wait` → `brief-parse` SKILL.md + bundled script | **Real** |
| Brief → Proposal on one thread (`plan-proposal` SKILL.md + bundled drafter) | **Real** |
| Per-tenant / per-agent skill and MCP allowlists (`agents.entries.*.skills`, no shared tool dump) | **Real** |
| campaign-core Brief/Proposal versions, memory pins, thread projections | **Real** |
| Tests when Gateway/runtime is missing | **Fail** (`openclaw_gateway_unavailable`) — not a fake pass |
| Official `openclaw` npm Gateway (~200MB, Node ≥24.16) | **Not embedded** — too heavy for this app’s Node 22 CI; local process speaks the documented protocol instead |
| OpenClaw Control UI, WhatsApp/channels, Skill Workshop, Hermes-style self-memory | **Not shipped** (Gateway HTTP 404s Control UI) |
| Full PDF engine (compressed/binary vendor PDFs) | **Not in this slice** |
| AE confirm / freeze-strategy UI, talent/content skills, KB retrieve, live MCP servers | **Later slices** |

OpenClaw mapping in this slice:

- Session start → skill snapshot + session MCP catalog (`tools.effective`)
- `agents.entries.*.skills` → published Agent allowlist (explicit `[]` means no skills)
- Progressive disclosure → catalog is `name` + `description` only
- One isolated Gateway process per tenant. Never one Gateway mixing customers.
- Embedding env: `OPENCLAW_NO_RESPAWN`, `OPENCLAW_SKIP_CHANNELS`, `OPENCLAW_DISABLE_BONJOUR`

## Layout

```
apps/campaign-agent/
  skills/brief-parse/SKILL.md     # Agent Skills bundle
  skills/plan-proposal/SKILL.md   # 策划 Skill
  src/campaign-core/              # artifacts, memory, gates (source of truth)
  src/openclaw-runtime/           # local OpenClaw-compatible Gateway process
  src/harness/                    # supervisor, WS client, skill loader
  src/server.ts                   # demo thread UI (spawns Gateway)
  tests/                          # missing Gateway fails; isolation; versioning
```

## Tests

```bash
npm test
```

Covers live Gateway drop-Brief, Brief → Proposal on one thread, fail-closed when the process is down, per-agent allowlists, two-tenant isolation, artifact versioning (`version_id` / append-only), no content cards before lock, and “do not invent budget/KPI/strategy”.
