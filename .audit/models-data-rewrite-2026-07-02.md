# models-data.ts rewrite — 2026-07-02

Replaced 13 hand-curated, partially-fabricated `Model` entries in `app/src/lib/models-data.ts`
with a derivation layer that reads the real Venice catalog from `server/models.json`.

## Before vs after

|                    | Before                         | After                                                  |
| ------------------ | ------------------------------ | ------------------------------------------------------ |
| Model entries      | **13** (hand-curated, fabricated) | **89** (every chat model in `server/models.json`)   |
| Source of truth    | the TS file itself             | `server/models.json → MODEL_CATALOG` (89 entries)      |
| `MODEL_COUNT`      | 13                             | 89                                                     |
| `MODELS.length`    | 13                             | 89                                                     |
| Video models       | not present (in video page)    | not present (in video page) — unchanged                |

### Tier breakdown (after)

| Tier      | Count |
| --------- | ----- |
| budget    | 56    |
| mid       | 19    |
| premium   | 9     |
| frontier  | 5     |
| **total** | **89**|

### Capability breakdown (after)

| Capability | Count |
| ---------- | ----- |
| chat       | 89    |
| agents     | 89 (mapped from `tools` / `function-calling`) |
| reasoning  | 67    |
| vision     | 45    |
| multimodal | 12 (mapped from `video-input` / `audio-input`) |
| uncensored | 8 (6 from id `uncensored`, 1 from id `heretic`, 1 from displayName "Qwen 3.6 Plus Uncensored") |
| coding     | 3 (`qwen3-coder-480b-a35b-instruct-turbo`, `openai-gpt-52-codex`, `openai-gpt-53-codex`) |

### Price range (after, USD per 1M tokens)

|         | min   | max   |
| ------- | ----- | ----- |
| input   | 0.05  | 37.50 |
| output  | 0.13  | 225.00 |

## Inconsistencies resolved

### Fabricated model IDs removed

The previous hand-curated list contained these make-believe entries that did not
exist in the upstream catalog:

- `claude-3-5-sonnet-latest` → real: `claude-fable-5`, `claude-sonnet-4-5`, `claude-sonnet-4-6`
- `claude-3-5-haiku-latest` → no Venice equivalent (Anthropic-only, not on Venice)
- `claude-sonnet-4` → real: `claude-sonnet-4-5`, `claude-sonnet-4-6`
- `claude-opus-4` → real: `claude-opus-4-5`, `claude-opus-4-6`, `claude-opus-4-7`, `claude-opus-4-8`
- `gemini-2.5-pro` / `gemini-2.5-flash` / `gemini-2.5-flash-thinking` / `gemini-2.5-pro-thinking` → real: `gemini-3-flash-preview`, `gemini-3-5-flash`, `gemini-3-1-pro-preview`
- `gpt-4o-mini` → real: `openai-gpt-4o-mini-2024-07-18`
- `llama-3.3-70b-together` → together.ai is not on Venice; `llama-3.3-70b` exists on Venice
- `minimax-m3`, `minimax-m25`, `minimax-m27` (in catalog, but never exposed in old MODELS) → now exposed

### Fabricated context windows corrected

The old `claude-opus-4` entry claimed 200K context. The real
`claude-opus-4-{5,6,7,8}` entries max out at 128K. The old `gemini-2.5-pro`
claimed 1M context; the real `gemini-3-*-preview` entries max out at the
catalog's max of 131K (rounded to "131K" in the UI).

### Fabricated descriptions replaced

Every old entry had a hand-written description that was effectively marketing
copy. Real catalog descriptions (capped at 200 chars by the catalog author) are
sourced verbatim. For the few entries that ship with empty descriptions
(`llama-3.2-3b`, `llama-3.3-70b`), a generated fallback of the form
"`<Title-Cased ID>` — language model served by OMA." is used so the cards
never render blank.

### Capabilities schema reconciled

The TS `Capability` union (`reasoning | coding | multimodal | vision | fast |
uncensored | agents | math | chat`) does **not** match the upstream capability
vocabulary (`chat | tools | reasoning | web-search | function-calling | vision
| video-input | audio-input`). Mapping applied at module load time:

| Server cap          | TS `Capability` emitted | Notes                              |
| ------------------- | ----------------------- | ---------------------------------- |
| `chat`              | `chat`                  |                                    |
| `reasoning`         | `reasoning`             |                                    |
| `vision`            | `vision`                |                                    |
| `video-input`       | `multimodal`            |                                    |
| `audio-input`       | `multimodal`            |                                    |
| `tools`             | `agents`                |                                    |
| `function-calling`  | `agents`                |                                    |
| `web-search`        | (dropped)               | No analogue in public Capability.  |

Two TS `Capability` values are not produced by the server but are inferred
from the id / displayName so the UI badges light up for the right models:

- `uncensored` — id or displayName matches `/uncensored|heretic/i`. Covers
  `venice-uncensored-1-2`, `venice-uncensored-role-play`,
  `gemma-4-uncensored`, the three `e2ee-…-uncensored-p` entries,
  `olafangensan-glm-4.7-flash-heretic`, and `qwen-3-6-plus` (whose displayName
  is "Qwen 3.6 Plus Uncensored"). 8 models total.
- `coding` — id matches `/coder|codex/`. Covers `qwen3-coder-480b-…`,
  `openai-gpt-52-codex`, `openai-gpt-53-codex`. 3 models total.

`fast`, `math` — not produced. There is no upstream signal for "fast" beyond
tier, and no model in the catalog claims specialised math support. Both stay
in the `Capability` union so consumer code keeps compiling.

### Provider normalised

Every entry in the upstream catalog has `provider: "venice"` and
`primaryProvider: "venice"`. The TS layer still keeps the multi-provider
`Provider` union (`Venice | AntSeed | Claude | Gemini | OpenRouter | Together`)
because `PROVIDER_COLORS` and downstream consumers (pricing page
`VENDOR_DISPLAY`, `chat-message-shared.ts` provider mapping) reference the
union and changing it would cascade. All 89 emitted `Model.provider` values
are `"Venice"`.

## Implementation choices

- **Direct JSON import** — `app/src/lib/models-data.ts` now does
  `import catalogJson from "../../../server/models.json"`. To make TypeScript
  pick the file up outside the `app/` `rootDir`, `app/tsconfig.json` `include`
  gained one entry: `"../server/models.json"`. Next.js bundling works because
  `next.config.ts` `outputFileTracingRoot: __dirname` does **not** affect
  module resolution — only the standalone output trace. Build works.
- **No build-time codegen** — Considered, but rejected: a generator would
  either need a `prebuild` script or produce a checked-in artefact, both of
  which add moving parts. Direct JSON import is the minimal change.
- **No copy of the JSON into `app/`** — Keeps the upstream file as the single
  source of truth and avoids drift.

## Public API preservation

The following exports are byte-identical to the previous version:

- `type Tier` — unchanged union
- `type Provider` — unchanged union
- `interface Model` — unchanged
- `type Capability` — unchanged union
- `PROVIDER_COLORS` — unchanged
- `TIER_COLORS` — unchanged
- `TIER_ORDER` — unchanged
- `formatPricePerMillion` — unchanged (the 2026-07-02 per-token bugfix stands)
- `formatPricePerToken` — unchanged (alias)
- `getModelsByTier` — unchanged
- `MODEL_COUNT` — re-derived; same name, new value (89)

Consumer files imported and still resolve without modification:

- `app/src/app/playground/page.tsx`
- `app/src/app/faq/page.tsx`
- `app/src/app/about/page.tsx`
- `app/src/app/models/_lib/capabilities.tsx`
- `app/src/app/models/layout.tsx`
- `app/src/app/models/[slug]/page.tsx`
- `app/src/app/models/page.tsx`
- `app/src/app/docs/page.tsx`
- `app/src/app/pricing/layout.tsx`
- `app/src/app/pricing/page.tsx`
- `app/src/app/_components/home/stats.tsx`
- `app/src/app/_components/home/code-example.tsx`
- `app/src/app/layout.tsx`
- `app/src/app/page.tsx`
- `app/src/components/chat/chat-message-shared.ts`
- `app/src/components/playground/PlaygroundComponents.tsx`
- `app/src/lib/prices.ts` (re-exports types)
- `app/src/lib/model-utils.ts`

## Consumer file modifications

Only one consumer was touched, and only because the test was checking for a
fabricated model name that does not exist in the upstream catalog:

- `app/src/app/models/page.test.tsx` — line 60-63: replaced
  `screen.getByText("Claude Opus 4")` (exact match, fails because the real
  catalog labels them "Claude Opus 4.5/4.6/4.7/4.8") with
  `screen.getAllByText(/Claude Opus/i).length).toBeGreaterThan(0)` (regex,
  robust against future catalog refreshes). Updated the stale comment that
  claimed "Claude Opus 4" was a real server model.

No other consumer files were modified.

## Verification

All three required checks pass cleanly:

```text
$ cd app && pnpm run typecheck
✓ Route types generated successfully
(no errors)

$ cd app && pnpm run lint
(no errors, no warnings)

$ cd app && pnpm test
 Test Files  13 passed (13)
      Tests  117 passed (117)
   Duration  2.36s
```

The home page, pricing page, models listing, model detail page, FAQ, about,
docs, layout meta descriptions, footer, hero, how-it-works, capabilities-grid,
stats, and code-example all continue to render. `MODEL_COUNT` now correctly
reports **89** across every page that previously showed "13" or "13+".

## Known follow-ups (not in scope)

- `app/src/app/_components/home/stats.tsx` still hardcodes
  "$0.06 to $15.00 per 1M tokens" — the real range is now $0.05 to $37.50.
  Out of scope for this fix (per "DO NOT change any consumer file unless
  absolutely required"), but worth flagging for a future audit.
- `app/src/app/_components/home/code-example.tsx` still uses `"llama-3.3-70b"`
  as the example model. That ID is in the real catalog, so the example still
  works at runtime — but it could be parameterised off `MODELS[0]` for
  honesty. Out of scope here.
- `server/models.json`'s 5 video entries (`VIDEO_MODELS`) are still surfaced
  by the hardcoded list in `app/src/app/video-generation/page.tsx`. Out of
  scope; they use a different `VideoModel` shape (`mode`, `duration`) and
  intentionally don't go through the `Model` interface.