// ponytail: production URL (https://api.oma-ai.com/v1) — references resolve once the gateway is deployed (audit C-1).
import { MODELS as CATALOG_MODELS } from '@/lib/models-data'
import {
  Play, Key, Terminal, Gauge, Zap, AlertCircle, Package, Boxes,
} from 'lucide-react'

export type Tab = { label: string; lang: string; code: string }

export type PlanLimits = {
  name: string
  rpm: number
  tpm: number
  rpd: number
  concurrent: number
  color: string
  badge: string
}

export type ModelRow = {
  id: string
  name: string
  provider: string
  tier: string
  input: number
  output: number
  ctx: string
  blurb: string
  capabilities: string[]
}

export type AuthMethod = {
  id: 'api-key' | 'wallet-x402' | 'account-number'
  label: string
  blurb: string
  note?: string
  example: { label: string; lang: string; code: string }
}

export type EndpointInfo = {
  id: string
  method: 'GET' | 'POST'
  path: string
  title: string
  desc: string
  auth: string
  body?: Record<string, string>
  params?: { name: string; type: string; desc: string }[]
  response: string
  errors: { code: number; type: string; when: string }[]
}

export type ErrorInfo = {
  code: number
  type: string
  desc: string
  fix: string
}

export type NavItem = {
  id: string
  label: string
  icon: typeof Play
  keywords: string[]
  headings: { id: string; label: string }[]
}

export const PLAN_LIMITS: PlanLimits[] = [
  { name: 'Free',       rpm: 60,    tpm: 60_000,    rpd: 5_000,    concurrent: 5,   color: 'text-text-secondary', badge: 'bg-surface text-text-secondary' },
  { name: 'Starter',    rpm: 120,   tpm: 120_000,   rpd: 25_000,   concurrent: 10,  color: 'text-accent',          badge: 'bg-accent/20 text-accent' },
  { name: 'Pro',        rpm: 300,   tpm: 300_000,   rpd: 100_000,  concurrent: 25,  color: 'text-tertiary',        badge: 'bg-tertiary/20 text-tertiary' },
  { name: 'Business',   rpm: 1000,  tpm: 1_000_000, rpd: 500_000,  concurrent: 100, color: 'text-warning',         badge: 'bg-warning/20 text-warning' },
]

export const MODEL_ROWS: ModelRow[] = CATALOG_MODELS.map((m) => ({
  id: m.id,
  name: m.name,
  provider: m.provider,
  tier: m.tier,
  input: m.inputPricePer1M,
  output: m.outputPricePer1M,
  ctx: m.contextLength,
  blurb: m.description,
  capabilities: m.capabilities,
}))

export const MODEL_PRICING = MODEL_ROWS

export const ENDPOINTS: EndpointInfo[] = [
  {
    id: 'chat',
    method: 'POST',
    path: '/v1/chat/completions',
    title: 'Chat Completions',
    desc: 'OpenAI-compatible multi-turn chat. The endpoint you will hit 95% of the time.',
    auth: 'Bearer token (API key) or PAYMENT-SIGNATURE (x402)',
    body: {
      model: 'string (required) — any model id from /v1/models',
      messages: 'array of { role, content } — role ∈ user | system | assistant',
      temperature: 'number 0–2, default 0.7',
      max_tokens: 'integer — cap on completion length',
      stream: 'boolean — Server-Sent Events when true',
      top_p: 'number 0–1 — nucleus sampling',
      frequency_penalty: 'number -2 to 2',
      presence_penalty: 'number -2 to 2',
    },
    response: `{
  "id": "chatcmpl-9f3k2a",
  "object": "chat.completion",
  "created": 1717194000,
  "model": "llama-3.2-3b",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "Hello. How can I help today?" },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 18, "completion_tokens": 12, "total_tokens": 30 }
}`,
    errors: [
      { code: 401, type: 'unauthorized', when: 'Missing or revoked API key' },
      { code: 402, type: 'payment_required', when: 'No credits and no x402 signature' },
      { code: 429, type: 'rate_limited', when: 'Plan RPM or TPM ceiling hit' },
    ],
  },
  {
    id: 'models',
    method: 'GET',
    path: '/v1/models',
    title: 'List Models',
    desc: 'Returns every model currently routable. No auth — useful for discovery and health checks.',
    auth: 'None',
    response: `{
  "object": "list",
  "data": [
    { "id": "llama-3.2-3b",        "object": "model", "owned_by": "meta" },
    { "id": "deepseek-v3.2",         "object": "model", "owned_by": "deepseek" },
    { "id": "claude-sonnet-4",     "object": "model", "owned_by": "anthropic" },
    { "id": "venice/flux-schnell", "object": "model", "owned_by": "black-forest-labs" }
  ]
}`,
    errors: [
      { code: 503, type: 'service_unavailable', when: 'All upstream providers are down' },
    ],
  },
  {
    id: 'embeddings',
    method: 'POST',
    path: '/v1/embeddings',
    title: 'Embeddings',
    desc: 'Vector embeddings for semantic search, RAG, and clustering. Currently routed through Venice embedding models.',
    auth: 'Bearer token (API key) or PAYMENT-SIGNATURE (x402)',
    body: {
      model: 'string (required) — e.g. "venice-embed-256"',
      input: 'string or string[] (required) — text to embed',
      encoding_format: '"float" (default) or "base64"',
    },
    response: `{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.0023, -0.0091, 0.0027, 0.0114, -0.0042]
    }
  ],
  "model": "venice-embed-256",
  "usage": { "prompt_tokens": 10, "total_tokens": 10 }
}`,
    errors: [
      { code: 400, type: 'bad_request', when: 'Empty input or unsupported model id' },
      { code: 402, type: 'payment_required', when: 'No credits and no x402 signature' },
    ],
  },
  {
    id: 'images',
    method: 'POST',
    path: '/v1/images/generations',
    title: 'Image Generation',
    desc: 'Text-to-image via Venice FLUX models. Output URLs are valid for 24 hours.',
    auth: 'Bearer token (API key) or PAYMENT-SIGNATURE (x402)',
    body: {
      model: 'string (required) — e.g. "venice/flux-schnell"',
      prompt: 'string (required)',
      n: 'integer 1–4, default 1',
      size: '"1024x1024", "768x1024", "1024x768", or "512x512"',
      response_format: '"url" (default) or "b64_json"',
    },
    response: `{
  "created": 1717194000,
  "data": [
    {
      "url": "https://files.oma-ai.com/img_4f3k2a.png",
      "revised_prompt": "A cat wearing a small felt hat, soft window light, 35mm"
    }
  ]
}`,
    errors: [
      { code: 400, type: 'bad_request', when: 'Prompt blocked by content filter or size unsupported' },
      { code: 402, type: 'payment_required', when: 'No credits and no x402 signature' },
    ],
  },
]

export const AUTH_METHODS: AuthMethod[] = [
  {
    id: 'api-key',
    label: 'API key',
    blurb: 'Generate a key from the dashboard, send it as a Bearer token. Standard for backends and scripts.',
    example: {
      label: 'cURL',
      lang: 'bash',
      code: `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.2-3b",
    "messages": [{ "role": "user", "content": "Hello" }]
  }'`,
    },
  },
  {
    id: 'wallet-x402',
    label: 'Wallet (x402)',
    blurb: 'No account. Sign a USDC payment off-chain with your wallet, send it in the PAYMENT-SIGNATURE header.',
    note: 'The no-account option. Use this from agents or when you do not want to fund a balance.',
    example: {
      label: 'Node',
      lang: 'javascript',
      code: `import { x402Fetch } from '@oma-ai/x402'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount(process.env.AGENT_KEY)

const res = await x402Fetch(
  'https://api.oma-ai.com/v1/chat/completions',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.2-3b',
      messages: [{ role: 'user', content: 'Hello' }],
    }),
  },
  { account, network: 'base' }
)

const json = await res.json()`,
    },
  },
  {
    id: 'account-number',
    label: 'Account number',
    blurb: 'Deposit USDC to your account number, get a credit balance, bill against it. Best for sustained usage.',
    example: {
      label: 'Python',
      lang: 'python',
      code: `import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["OMA_KEY"],          # bound to your account
    base_url="https://api.oma-ai.com/v1",
)

resp = client.chat.completions.create(
    model="llama-3.2-3b",
    messages=[{"role": "user", "content": "Hello"}],
)`,
    },
  },
]

export const ERROR_CODES: ErrorInfo[] = [
  { code: 400, type: 'bad_request',         desc: 'Malformed body, bad JSON, or a field we do not recognize.', fix: 'Validate against the endpoint schema. The error body lists the offending field.' },
  { code: 401, type: 'unauthorized',        desc: 'Missing, malformed, or revoked API key.',                   fix: 'Check the Authorization header. Generate a new key from the dashboard if revoked.' },
  { code: 402, type: 'payment_required',    desc: 'No credits on the account and no x402 signature attached.',  fix: 'Top up the account, or send a PAYMENT-SIGNATURE header for x402 pay-per-request.' },
  { code: 429, type: 'rate_limited',        desc: 'Per-minute, per-day, or concurrent request ceiling hit.',   fix: 'Read the X-RateLimit-Reset header, wait that long, then retry with exponential backoff.' },
  { code: 500, type: 'internal_error',      desc: 'Something failed on our side. Retries usually work.',        fix: 'Retry up to 3 times with backoff. If it keeps failing, open a ticket with the request id.' },
  { code: 503, type: 'service_unavailable', desc: 'Every upstream provider we route to is down.',               fix: 'Try a different model, or wait. The status page is the source of truth during incidents.' },
]

export const ERROR_FORMAT = `{
  "error": {
    "type": "rate_limited",
    "code": "rate_exceeded",
    "message": "RPM ceiling of 300 reached for the Pro plan. Resets in 42 seconds.",
    "request_id": "req_4f3k2a"
  }
}`

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'quickstart',
    label: 'Quickstart',
    icon: Play,
    keywords: ['get started', 'first', 'install', 'hello world', 'setup', 'introduction'],
    headings: [
      { id: 'qs-step-key',     label: '1. Get a key' },
      { id: 'qs-step-request', label: '2. Make a request' },
      { id: 'qs-step-response',label: '3. Read the response' },
    ],
  },
  {
    id: 'authentication',
    label: 'Authentication',
    icon: Key,
    keywords: ['auth', 'api key', 'bearer', 'token', 'x402', 'wallet', 'sign in', 'login'],
    headings: [
      { id: 'auth-key',         label: 'API key' },
      { id: 'auth-wallet',      label: 'Wallet (x402)' },
      { id: 'auth-account',     label: 'Account number' },
      { id: 'auth-errors',      label: 'Auth errors' },
    ],
  },
  {
    id: 'endpoints',
    label: 'Endpoints',
    icon: Terminal,
    keywords: ['rest', 'api', 'http', 'route', 'path', 'request', 'response', 'reference'],
    headings: [
      { id: 'ep-chat',         label: 'Chat completions' },
      { id: 'ep-models',       label: 'List models' },
      { id: 'ep-embeddings',   label: 'Embeddings' },
      { id: 'ep-images',       label: 'Image generation' },
    ],
  },
  {
    id: 'models',
    label: 'Models',
    icon: Boxes,
    keywords: ['catalog', 'llm', 'llama', 'deepseek', 'qwen', 'flux', 'gpt', 'claude', 'pricing', 'cost'],
    headings: [
      { id: 'models-overview', label: 'Overview' },
      { id: 'models-table',    label: 'Full catalog' },
    ],
  },
  {
    id: 'rate-limits',
    label: 'Rate limits',
    icon: Gauge,
    keywords: ['rpm', 'tpm', 'rpd', 'throttle', 'quota', 'limit', 'reset', 'backoff', '429'],
    headings: [
      { id: 'rl-plans',   label: 'Plan limits' },
      { id: 'rl-headers', label: 'Response headers' },
      { id: 'rl-when',    label: 'When you hit the ceiling' },
    ],
  },
  {
    id: 'x402',
    label: 'x402 payments',
    icon: Zap,
    keywords: ['crypto', 'usdc', 'base', 'pay per request', 'no account', 'agent', '402', 'eip-3009'],
    headings: [
      { id: 'x402-what',  label: 'What is x402?' },
      { id: 'x402-flow',  label: 'How a payment works' },
      { id: 'x402-code',  label: 'Code examples' },
      { id: 'x402-where', label: 'Where it runs' },
    ],
  },
  {
    id: 'sdks',
    label: 'SDKs',
    icon: Package,
    keywords: ['openai', 'vercel', 'langchain', 'sdk', 'client', 'library', 'install', 'npm', 'pip'],
    headings: [
      { id: 'sdk-openai',    label: 'OpenAI SDK' },
      { id: 'sdk-vercel',    label: 'Vercel AI SDK' },
      { id: 'sdk-langchain', label: 'LangChain' },
      { id: 'sdk-direct',    label: 'Direct HTTP' },
    ],
  },
  {
    id: 'errors',
    label: 'Errors',
    icon: AlertCircle,
    keywords: ['400', '401', '402', '429', '500', '503', 'status code', 'http code', 'debug', 'failure'],
    headings: [
      { id: 'err-format', label: 'Response format' },
      { id: 'err-common', label: 'Common errors' },
      { id: 'err-retry',  label: 'Retry pattern' },
    ],
  },
]

export function fmt(n: number): string {
  if (n === 0) return '$0.00'
  if (n < 0.01) return '$0.001'
  return `$${n.toFixed(2)}`
}

export function filterNav(query: string, items: NavItem[]): NavItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((it) => {
    if (it.label.toLowerCase().includes(q)) return true
    if (it.id.toLowerCase().includes(q)) return true
    return it.keywords.some((k) => k.toLowerCase().includes(q))
  })
}
