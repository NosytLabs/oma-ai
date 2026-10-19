# Provider logo tiles

Used by `ModelLogo` as a fallback when the dashboard-icons CDN doesn't
have a slug for the provider. Prefer the CDN first (authentic brand
colors) and only fall back to these tiles for vendors that aren't in
the upstream catalog.

Tiles were downloaded from
https://github.com/homarr-labs/dashboard-icons (Apache-2.0
licensed). File names match the upstream slugs so the `slug → url`
mapping in `app/src/components/ui/model-logo.tsx` lines up 1:1.

## What ModelLogo actually renders (Nov 2026)

The table below lists which **tile** `ModelLogo` uses per provider
today. A tile marked "_(no tile — initials badge)_" means the
provider's slug is in `DASHBOARD_ICON_SLUGS` removed and there is
no local fallback; the `ModelLogo` fallback branch renders the
initials badge from `FALLBACK_COLORS`.

Eight of the original 18 mapped vendors currently fall through to the
initials badge because their vendored SVGs render as effectively
blank at the 36×36 card tile size (off-canvas viewBox, root
`fill="none"` with low opacity, or chromium-headless decoding
edge cases). The SVG assets for those vendors are no longer in this
folder — they were kept in git history only. If you fix one and
want to restore it, port the corrected SVG back, re-add the slug to
`DASHBOARD_ICON_SLUGS` in `model-logo.tsx`, and pin the tile back
into this folder.

| Provider        | Tile rendered            | Status        |
| --------------- | ------------------------ | ------------- |
| OpenAI          | `openai.svg`             | works         |
| Anthropic       | `anthropic.svg`          | works         |
| Google (Gemma)  | `google.svg`             | works         |
| Gemini          | `google-gemini.svg`      | works         |
| Meta / Llama    | _(no tile — initials)_   | fallback      |
| DeepSeek        | `deepseek.svg`           | works         |
| Mistral         | `mistral-ai.svg`         | works         |
| Grok / xAI      | _(no tile — initials)_   | fallback      |
| Moonshot / Kimi | _(no tile — initials)_   | fallback      |
| Alibaba Qwen    | _(no tile — initials)_   | fallback      |
| Xiaomi / MiMo   | _(no tile — initials)_   | fallback      |
| Z.AI / GLM      | `z-ai.svg`               | works         |
| MiniMax         | _(no tile — initials)_   | fallback      |
| Mercury / Inception | `mercury.svg`        | hand-tuned    |
| Venice AI       | `venice.svg`             | hand-tuned; OG |
|                 |                          | meta uses it  |
| Coinbase / Base | `coinbase.svg`           | hand-tuned    |
| OMA-AI / Gonka  | `gonka.svg`              | hand-tuned    |
| Ethereum        | _(no tile — initials)_   | fallback      |

If you're reading this because the catalog picked up a new
provider: prefer adding it to `DASHBOARD_ICON_SLUGS` only after
verifying the upstream SVG renders cleanly at 36×36 (check the
viewBox and root fill). If the test fails, omit the slug entirely
and let `ModelLogo` fall through to the initials badge.
