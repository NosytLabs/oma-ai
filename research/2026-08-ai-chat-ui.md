# AI Chat Interface — Design Research Notes (2026-08-06)

Sources: thefrontkit.com (AI Chat UI Best Practices 2026), setproduct.com
(Designing AI chat interfaces: anatomy, patterns, pitfalls).

## Streaming — the signature state

- **First-token target < 800 ms** after submit. If slower, show a queued state.
- **Optimistic user message**: render the user's prompt instantly before the
  request leaves the client (saves 100–300 ms perceived latency). ✅ already done
  in `ChatPlaygroundShell` (`deferredMessages`).
- **Token grouping**: never re-render the DOM on every token. Batch into
  30–60 ms paint windows; otherwise CPU spikes and jank.
- **Stop / retry controls** must be visible during streaming and disappear
  the moment generation ends. ✅ `MessageInputRedesign` toggles send→stop.
- **Defer code-block rendering** until the closing fence or a token after it,
  so a half-open ``` block never flicks a collapsed widget.
- **Don't artificially slow streaming** to "feel human".

## Structure & layout

- Assistant reply column capped at ~65–80 chars per line for sustained
  reading. ✅ `MessagesList` uses `max-w-4xl`; user bubbles ≤ ~80%.
- **Composer docked to the bottom**, never floating over the last message;
  padding under the stream = composer height + safe area.
- Send/stop buttons ≥ 44 px tall for thumb reach.
- **Full-width layout is now the norm** for serious AI chat; separate user vs
  assistant via alignment + background shading, not max-width gimmicks.
- Aim for plain user bubbles vs. minimal-line assistant blocks (no box).

## Accessibility

- Put the assistant message inside `aria-live="polite"` so screen readers
  announce streamed content.
- Add `aria-atomic="false"` so only *new* tokens are announced, not the
  whole message re-read on every flush.
- **Debounce announcements during fast streaming** — announcing every token
  is overwhelming; batch every few seconds. Best: render container is
  `aria-live="polite"` and stop updates announce "reply complete".
- Focus must NOT jump to the assistant reply when streaming completes.
- Full keyboard navigation: Tab through actions; Enter send, Shift+Enter
  newline. ✅ `useChatShortcuts` + composer hint text.

## Trust & honesty

- Show model name + version, timing, and optional cost. ✅ toolbar badge +
  `StatsBar` + `CostEstimate`.
- Never silently truncate/summarize earlier messages — show a marker when
  context is dropped or summarized.
- Distinct visual styling for assistant vs user; never auto-delete history
  without consent.

## Current codebase verdict

Strong alignment already. One gap worth a one-line fix: the message renderer
uses `aria-live="polite"` but not `aria-atomic="false"` (announce only new
content). See `ChatMessageRedesign.tsx`.