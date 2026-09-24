# Refactor Plan — catalog, streaming hook, auth middleware

Date: 2026-09-24 · Status: **proposed, nothing implemented**
Method: every claim below was verified against the working tree and the live
site before writing. Three initial premises turned out to be wrong; they are
recorded in "Premises that did not survive checking" rather than quietly
dropped.

---

## Executive summary

Of the three refactors requested, **one is worth doing, one should become a
test instead of a refactor, and one should not be done at all** because the
duplication it targets no longer exists.

| # | Target | Recommendation | Risk if done | Real value |
|---|--------|----------------|--------------|------------|
| 1 | Model catalog (848 + 509 lines) | **Parity test, no refactor** | Medium | High |
| 2 | `useStreamingChat` (734 lines) | **Extract the SSE parser** | Medium | High |
| 3 | "Duplicated auth middleware" | **Do not proceed** | — | None |

---

## Target 1 — Model catalog: add a parity test, do not refactor

### What exists

- `app/src/lib/models-data.ts` — 848 lines. Ships a **static fallback** of 20
  models with the *marked-up* price baked in, then loads the full catalog at
  runtime from `/v1/models`.
- `server/src/inference/models.ts` — 509 lines. `VENICE_MODELS` (18) +
  OMA-AI models (2), each with the raw upstream `inputPricePer1M` and a
  `markupPercent` field.

### The finding that changes the plan

I expected the two price sets to have drifted. **They have not.** For all 20
models:

```
app_price == server_price * (1 + markupPercent / 100)
```

Verified: 20 consistent, **0 mismatched**, 0 missing a markup field.
Provider split: 18 venice, 2 oma-ai.

The `markupPercent: 25` comment in the server file says the raw rate is the
source of truth and the server applies markup. The app fallback has the
result already marked up. So the duplication is **intentional and currently
correct** — not a defect.

### Why "refactor" is the wrong move

The risk is not present-tense correctness, it is **unenforced future drift**.
Nothing fails if someone changes `markupPercent` on the server: the website
would keep displaying and quoting the old price while billing the new one.
That is precisely the class of defect this session has been fixing on
`/pricing` and `/models`.

So: do not restructure 1,357 lines of live, currently-correct pricing code to
prevent a bug that has not happened. **Add the test that would catch it.**

### Proposed change

New test, `app/src/lib/models-data.parity.test.ts` (or in `server/` — decide
by which package owns the invariant):

- Parse `VENICE_MODELS` + OMA models from `server/src/inference/models.ts`.
- Assert the app fallback contains exactly the same **set of 20 ids**.
- Assert `app.inputPricePer1M === server.inputPricePer1M * (1 + markup/100)`
  for every id, and likewise for output price.
- Assert no id exists on one side only.

Cost: one test file, no production code touched. If it ever goes red, someone
has changed a price without regenerating the fallback.

### Optional follow-up (separate, later)

If the parity test proves annoying to maintain, a codegen step
(`scripts/gen-model-fallback.ts`) that writes the app fallback from the server
catalog at build time is the real fix. **Do not do this yet** — it changes the
build and the client bundle for a problem a test already covers.

---

## Target 2 — `useStreamingChat`: extract the SSE parser (do this one)

### What exists

`app/src/app/chat/_hooks/useStreamingChat.ts` — **734 lines**.

Already extracted and tested (do not redo):
- `sanitizeHistory` (line 45)
- `newMessageId` (line 64)
- `__tests__/useStreamingChat.helpers.test.ts` — 232 lines, **21 tests**

The remaining weight is the `streamChatCompletion` `useCallback`, lines
244–~550 — **~306 lines in a single callback**, containing these inner
closures:

| Line | Closure | Job |
|------|---------|-----|
| 282 | `doFetch` | fetch + retry/timeout |
| 378 | `flushToState` | batched state writes |
| 423 | `appendToContent` | stream → content buffer |
| 434 | `appendToReasoning` | stream → reasoning buffer |
| 444 | `processData` | **SSE frame parsing** |

`processData` and the append/flush helpers are **pure functions of
`(chunk, state) → state`** with no React or network dependency. They are
currently untestable in isolation because they're closures inside a callback —
you can only reach them by driving a full stream through a mounted hook.

### Proposed change

1. Extract `processData` + `appendToContent` + `appendToReasoning` +
   `flushToState` into `app/src/app/chat/_hooks/stream-parser.ts` as pure
   exported functions over an explicit state object.
2. `streamChatCompletion` imports them and keeps the network/React wiring.
3. Add `__tests__/stream-parser.test.ts` covering: normal `data:` frames,
   `[DONE]` sentinel, split frames across chunk boundaries, malformed JSON,
   reasoning-vs-content routing, and a frame carrying both.
4. **Guard with the existing 21 hook tests** — they must stay green, which
   proves the extraction was behaviour-preserving.

### Why this one is worth the risk

It is the most intricate code in the app, the hardest to test today, and on
the live money path (chat completions). Extracting pure parsing from network
orchestration is the highest-value structural change available, and the
existing test suite bounds the risk.

### Sequencing

Do this **after** Target 1's test lands, and in its own commit so it can be
reverted independently.

---

## Target 3 — "Duplicated auth middleware": do not proceed

The premise does not hold.

- `resolveAuthBackend` is defined **exactly once**, at
  `app/src/lib/auth-proxy.ts:4`. The duplication I remembered is gone.
- The server middleware files are small and single-purpose, with no overlap:

  | File | Lines |
  |------|-------|
  | `middleware/audit.ts` | 102 |
  | `middleware/daily-limit.ts` | 186 |
  | `middleware/demo-mode-guard.ts` | 89 |
  | `middleware/origin-guard.ts` | 96 |
  | `middleware/rate-limit.ts` | 23 |
  | `middleware/security.ts` | 24 |
  | `auth/middleware.ts` | 416 (6 distinct exports) |

**Recommendation: close this item.** There is nothing to consolidate.

---

## Genuine duplication found along the way (low risk, optional)

A cross-repo scan for duplicate function names surfaced real, harmless
duplication. None of it is a live bug, so this is a maintenance item, not a
fix.

| Symbol | Copies | Locations |
|--------|--------|-----------|
| `formatPrice` | **4, byte-identical** | `models/[slug]/page.tsx:61`, `_components/LiveModelDetail.tsx:50`, `_components/ModelDetailShared.tsx:5`, `_components/StaticModelDetail.tsx:18` |
| `liveDisplayName` | 3 | `models/[slug]/page.tsx:27`, `LiveModelDetail.tsx:33`, `lib/model-utils.ts:47` |
| `livePricePer1M` | 2 | `models/[slug]/page.tsx:53`, `LiveModelDetail.tsx:42` |
| `estimateTokens` | 2 | `app/src/lib/text.ts:9`, `server/src/inference/token-utils.ts:22` |
| `getModelPricing` | 2 | `components/playground/PlaygroundComponents.tsx:24`, `server/src/inference/billing-service.ts:38` |

The four `formatPrice` copies are verified identical, so consolidating them
into `app/src/lib/model-utils.ts` is a safe, mechanical win.

### Three price formatters exist — and this one needs care

| Formatter | Behaviour | Used by |
|-----------|-----------|---------|
| `formatPrice` (4 copies) | `toFixed(2)`, 3dp under $0.01 | model **detail** pages |
| `formatPricePerMillion` | **rounds UP to nearest $0.05** | homepage headline, `/pricing` lowest |
| `fmtPrice` (`pricing/_lib/pricing-utils`) | own logic | `/pricing` **table** |

I calculated that these would disagree for **12 of 20** models (e.g.
`deepseek-v4-flash-0731` → `$0.22` on detail vs `$0.25` in the catalog), and
was about to report it as a live bug.

**It is not a live bug.** Verified in the browser: `/models` renders
`qwen-3-7-plus` at **$0.63** and `openai-gpt-56-sol` at **$7.81** —
identical to their detail pages. The homepage headline reads
**"Budget from $0.15 / 1M tokens"**, and the cheapest model
(`google-gemma-4-31b-it`, $0.12 raw × 1.25 markup) renders `$0.15` through
**both** formatters. They agree wherever they actually overlap.

**Do not "fix" this.** Consolidating the formatters would change displayed
prices and needs a deliberate pricing decision, not a refactor.

---

## Premises that did not survive checking

Recorded so nobody re-investigates them:

1. **"The frontend model catalog is 230 lines and duplicated with the server."**
   The app catalog is **848** lines, and the duplication is intentional
   (marked-up fallback mirroring the raw server catalog), currently exact.
2. **"`useStreamingChat` is 306 lines."** The file is **734**; 306 is the
   size of the one oversized `useCallback` inside it.
3. **"Auth middleware is duplicated."** It is not — see Target 3.
4. **"The model prices have drifted between app and server."** They have not —
   20/20 exact under the markup formula.

---

## Execution order

1. Target 1 parity test — one commit, no production code, proves the catalog
   invariant that is currently undefended.
2. Target 2 SSE parser extraction — one commit, 21 existing tests must stay
   green.
3. Optional: consolidate the 4 identical `formatPrice` copies — mechanical,
   after the above land.

Targets 1 and 2 are independent and can ship in either order. **Neither
should be bundled into a release that also changes pricing or auth.**
