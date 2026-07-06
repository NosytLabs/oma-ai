# OMA-AI for AI agents

Quickstart guide for AI agents and automated systems that want to use OMA-AI
as an inference provider. OMA-AI serves every model behind one
OpenAI-compatible API and accepts x402 payments per request, so any agent
that can run curl, the OpenAI SDK, or an x402 client can use it without a
human account.

## 1. Quick start (API key)

Sign up at [oma-ai.com](https://oma-ai.com) to get $0.05 in free credits and
an API key. The credit card step is skipped; wallet-based accounts are
optional.

```bash
export OMA_KEY="${OMA_KEY:-oma_sk_...}"  # issued at signup or from env
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
  apiKey: process.env.OMA_KEY ?? "oma_sk_...",
  baseURL: "https://api.oma-ai.com/v1",
});
const resp = await client.chat.completions.create({
  model: "llama-3.3-70b",
  messages: [{ role: "user", content: "Hello" }],
});
```

## 2. OpenAI-compatible endpoints

All paths mirror OpenAI's API. Set `base_url` once and reuse any OpenAI SDK.

| Path | Notes |
|---|---|
| `POST /v1/chat/completions` | Streaming, tool calls, structured outputs |
| `POST /v1/embeddings` | Text embeddings |
| `POST /v1/images/generations` | Returns `{ "data": [{ "url": "..." }] }` |
| `POST /v1/videos/generations` | Async; poll `/v1/videos/retrieve?id=...` |
| `GET  /v1/models` | Full catalog as JSON |
| `GET  /v1/privacy` | Machine-readable privacy manifest |

Streaming example:
```bash
curl https://api.oma-ai.com/v1/chat/completions \
  -H "Authorization: Bearer $OMA_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-3-7-plus",
    "stream": true,
    "messages": [{"role": "user", "content": "Stream me a story."}]
  }'
```

## 3. Model catalog

The full catalog is at `GET /v1/models`. Highlights:

- **Frontier**: Claude Opus 4.8, Claude Fable 5, GPT-5.4 Pro, Grok 4.3,
  Gemini 3.1 Pro Preview, DeepSeek V4 Pro.
- **Mid**: Claude Sonnet 4.6, GPT-5.4 Mini, Qwen 3.7 Max, Kimi K2.6,
  Llama 3.3 70B.
- **Budget**: GLM 4.7 Flash, Qwen3 5B-9B, Mistral Small 4, GPT-OSS 120B,
  Gemma 4 31B.

Filtering and listing:
```bash
curl https://api.oma-ai.com/v1/models \
  -H "Authorization: Bearer $OMA_KEY" | jq '.data[] | {id, category: .meta.category}'
```

Each entry includes `inputPricePer1M`, `outputPricePer1M`, `markupPercent`,
`capabilities`, and `maxTokens`.

## 4. x402 payment flow (pay-per-request)

For agents that should pay per request from their own USDC balance on Base —
no account, no signup, no API key:

```ts
import { x402Fetch } from "@oma-ai/x402";

const res = await x402Fetch(
  "https://api.oma-ai.com/v1/x402/proxy/chat/completions",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b",
      messages: [{ role: "user", content: "Hello" }],
    }),
    wallet: agentWallet,        // ethers Wallet or viem account
    network: "base",
  },
);
const data = await res.json();
```

Under the hood:
1. Agent requests the endpoint with no API key.
2. OMA returns `402 Payment Required` with a `Pay-Req:` quote header
   (amount in USDC, x402 v1 scheme, EVM network `base`).
3. Agent signs the quote (gasless via EIP-3009 transferWithAuthorization)
   and re-sends with the signed payload in the `Pay-Req:` header.
4. OMA verifies, settles on-chain, and proxies the request to the model.

You can also do it manually:
```bash
# 1. Get a quote
curl -i https://api.oma-ai.com/v1/x402/quote \
  -H "Content-Type: application/json" \
  -d '{ "model": "llama-3.3-70b", "messages": [{ "role": "user", "content": "Hi" }] }'

# 2. Sign the Pay-Req with USDC.EIP-3009 (use @oma-ai/x402, ethers, viem, ...)

# 3. Resend with the signed header
curl https://api.oma-ai.com/v1/x402/proxy/chat/completions \
  -H 'Pay-Req: {"x402Version":"1","scheme":"evm","networkId":"base","asset":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","amount":"0.00025","payee":"0x..."}' \
  -H "Content-Type: application/json" \
  -d '{ "model": "llama-3.3-70b", "messages": [{ "role": "user", "content": "Hi" }] }'
```

## 5. Rate limits

Defaults (per API key, sliding 60s window in Redis):

| Tier | Requests/min | Use |
|---|---|---|
| Free (auto) | 60 | Signup tier |
| Standard | 120 | After first deposit |
| Pro | 300 | Bulk users |
| Scale | 1000 | Negotiated |

Headers returned on every response:
- `X-RateLimit-Limit` — your current tier's rpm
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset` — seconds until the window resets

On `429 Too Many Requests`, retry after `Retry-After` seconds. x402 requests
are throttled the same way but paid per call, so they don't consume credits.

Per-model limits (concurrent in-flight requests) are documented at
`/docs#rate-limits` and may be lower for expensive frontier models.

## 6. Privacy and data handling

- Prompts and completions are **never stored**. They flow through OMA to the
  upstream provider and are not logged.
- OMA stores only: wallet address, hashed API keys, credit balance, billing
  records (model, tokens, cost, latency).
- No email, no phone, no card — wallet-based identity is the default.
- Full machine-readable policy: `GET /v1/privacy`.
- Data export: `GET /v1/account/export`. Account deletion: `POST /v1/account/delete`.
- OMA does not train on your data and does not sell your data.

## 7. SDKs and clients

| Stack | How |
|---|---|
| Python | `pip install openai`, set `base_url="https://api.oma-ai.com/v1"` |
| TypeScript / Node | `npm i openai`, set `baseURL` |
| Vercel AI SDK | `baseURL: "https://api.oma-ai.com/v1"` |
| LangChain | `ChatOpenAI({ openAIApiKey, configuration: { basePath } })` |
| x402 / agent wallets | `npm i @oma-ai/x402` |
| Raw HTTP | `curl` works directly |

## 8. Common error codes

| Status | Meaning | Recovery |
|---|---|---|
| 400 | Bad request body | Fix the JSON; check required fields |
| 401 | Missing or bad API key | Re-issue at `/dashboard/api-keys` |
| 402 | Payment required (x402) | Sign and resend with `Pay-Req` |
| 404 | Model not found | `GET /v1/models` to see what exists |
| 422 | Discount-floor violation | Customer-balance / Surplus guard tripped |
| 429 | Rate limited | Wait `Retry-After` seconds |
| 502 | Upstream provider error | Retry with backoff; OMA already tried fallbacks |
