# Campaign Agent (slice 1)

Conversation is the product face. OpenClaw is the harness *shape*. Campaign contracts are ours.

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

Generate the sample PDF fixture (UTF-16BE content stream, readable by this slice’s extractor):

```bash
npm run demo -- --write-sample-pdf fixtures/briefs/complete.pdf
npm run demo -- fixtures/briefs/complete.pdf
```

## What this slice does

1. **Harness loop (Skill + MCP session)** — per-tenant isolated runtime config. An Agent only sees its published skill allowlist and MCP tool allowlist. No global tool dump.
2. **campaign-core** — versioned `Brief` artifact + campaign memory index that pins `(object_id, version)`. The thread stores projections (`artifact_ref`), not the object.
3. **`brief-parse` SKILL.md** — real Agent Skills bundle. Demo path: drop Brief PDF/text → structured Brief with `version_id`. Missing budget/KPI → `open_questions` (never invented).

Content cards are gated even though the content skill is not in this slice: lock-row before any `ContentPack`. Until then the content worker only emits a wait message.

## Real vs adapter

| Piece | Status |
|---|---|
| Agent Skills `SKILL.md` load (frontmatter routing, then full body + `scripts/` + `references/`) | **Real** |
| Per-tenant / per-agent skill and MCP allowlists | **Real** |
| campaign-core Brief versions, memory pins, thread projections | **Real** |
| Local harness loop (`LocalLoopAdapter`) that routes a dropped Brief to `brief-parse` and runs `scripts/parse-brief.mjs` | **Real** |
| `OpenClawHarnessAdapter` / `OpenClawSession` matching OpenClaw session + skill snapshot + session MCP concepts | **Adapter interface** |
| `OpenClawGatewayAdapter` talking to a live OpenClaw Gateway process | **Stub** (throws `openclaw_gateway_not_embedded`, not a fake success) |
| OpenClaw Control UI, WhatsApp/channels, Skill Workshop, Hermes-style self-memory | **Not shipped** |
| Full PDF engine (compressed/binary vendor PDFs) | **Not in this slice** — extractor reads uncompressed literals + UTF-16BE hex strings. If text cannot be read, fields stay empty and become `open_questions`. |
| Gates UI (AE confirm card), plan/talent/content skills, KB retrieve | **Later slices** |

OpenClaw mapping we will keep when a Gateway is actually embedded:

- Session start → skill snapshot + `getOrCreateSessionMcpRuntime`
- `agents.entries.*.skills` → our published Agent allowlist
- Progressive disclosure → catalog is `name` + `description` only
- One isolated runtime per tenant (or per published Agent). Never one Gateway mixing customers.

## Layout

```
apps/campaign-agent/
  skills/brief-parse/SKILL.md   # Agent Skills bundle
  src/campaign-core/            # artifacts, memory, gates
  src/harness/                  # skill loader, OpenClaw adapter, local loop
  src/server.ts                 # demo thread UI
  tests/                        # versioning, skill load, ungated content cards
```

## Tests

```bash
npm test
```

Covers artifact versioning, skill allowlist load, no content cards before lock, and “do not invent budget/KPI”.
