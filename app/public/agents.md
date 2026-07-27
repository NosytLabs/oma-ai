# OMA-AI for AI agents

Quickstart for agents and automated systems that use OMA as an
OpenAI-compatible inference gateway. OMA accepts API keys, SIWE sessions, and
x402 pay-per-request USDC settlement on Base.

## 1. Quick start (API key)

Get a key at [oma-ai.com/login](https://oma-ai.com/login).

```bash
export OMA_KEY="${OMA_KEY:-oma_sk_...}"
curl https://api.oma-ai.com/v1/chat/completions \
  -H "Authorization: Bearer $OMA_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.3-70b",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

OpenAI SDK drop-in:

```python
from openai import OpenAI
import os
client = OpenAI(
    api_key=os.environ.get("OMA_KEY", "oma_sk_..."),
    base_url="https://api.oma-ai.com/v1",
)
resp = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Hello"}],
)
```

```ts
import OpenAI from "openai";
const client = new OpenAI({
  apiKey: process.env.OMA_KEY,
  baseURL: "https://api.oma-ai.com/v1",
});
```

## 2. x402 pay-per-request

Agents can settle each call in USDC without a pre-funded credit balance.
See [docs#x402](https://oma-ai.com/docs#x402) for quote + settle flow.

## 3. Models

`GET https://api.oma-ai.com/v1/models` returns the live catalog. Each entry
carries `pricing.prompt` / `pricing.completion` (per-token USD strings),
`context_length`, `architecture`, and `supported_parameters`.

## 4. Privacy

Zero data retention on prompt content. Self-hosted deployment is supported
for maximum control. See [privacy](https://oma-ai.com/privacy).

## Links

- Product: https://oma-ai.com
- Docs: https://oma-ai.com/docs
- Source: https://github.com/NosytLabs/oma-ai
