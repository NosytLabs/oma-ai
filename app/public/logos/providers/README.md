# Provider logo tiles

Used by `ModelLogo` as a fallback when the dashboard-icons CDN doesn't have a
slug for the provider. Prefer the CDN first (authentic brand colors) and
only fall back to these tiles for vendors that aren't in the upstream catalog.

Tiles were downloaded from https://github.com/homarr-labs/dashboard-icons
(Apache-2.0 licensed). File names match the upstream slugs so the `slug → url`
mapping in `app/src/components/ui/model-logo.tsx` lines up 1:1.

| File | Used for |
|------|----------|
| `openai.svg` | GPT / OpenAI-family ids |
| `anthropic.svg` | Claude / Anthropic |
| `google.svg` | Google (Gemma) |
| `google-gemini.svg` | Gemini |
| `meta.svg` | Llama |
| `deepseek.svg` | DeepSeek |
| `mistral-ai.svg` | Mistral |
| `grok.svg` | Grok / xAI |
| `kimi-ai.svg` | Kimi / Moonshot |
| `qwen.svg` | Qwen |
| `xiaomi-global.svg` | MiMo / Xiaomi |
| `z-ai.svg` | GLM / Z.ai / Zhipu |
| `minimax.svg` | MiniMax |
| `gonka.svg` | OMA-AI / Gonka Network (free in chat/playground) |
| `mercury.svg` | Mercury / Inception (hand-tuned, no upstream slug) |
| `venice.svg` | Venice AI (hand-tuned, no upstream slug) |
| `coinbase.svg` | Base / Coinbase payment rails (hand-tuned, no upstream slug) |
| `ethereum.svg` | ETH payment rails |