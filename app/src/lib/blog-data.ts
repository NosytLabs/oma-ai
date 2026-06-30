interface BlogPost {
  slug: string
  title: string
  excerpt: string
  content: string
  author: string
  publishedAt: string
  readingTime: number
  tags: string[]
  featured?: boolean
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'introducing-oma-ai',
    title: 'Introducing OMA AI: Permissionless Inference on Base',
    excerpt:
      'Why we built a thin gateway over upstream model providers, how wallet auth and USDC settlement work, and what permissionless AI means for developers.',
    content: `## The Problem

Every AI API forces you through the same funnel: sign up, verify email, add a card, wait for approval, then pray your rate limits are enough. For developers building agents, automation, or anything that needs to run headless, this is friction you do not need.

## The Solution

OMA is a thin inference gateway. We do not train models. We do not host them. We authenticate your wallet, meter your tokens, and forward your request to the best available upstream provider. Settlement happens on Base in USDC.

## How It Works

1. You send an OpenAI-compatible request to \`https://api.oma-ai.com/v1\`
2. We verify your wallet via SIWE or check your API key
3. We route to Venice (or failover providers) with circuit-breaker logic
4. We deduct credits in real-time and settle on Base via x402

## What Permissionless Means

- No email gate. No sales call. No enterprise contract.
- Pay per request in USDC, or pre-fund credits.
- The same API works from a laptop in Montreal and a CI job in São Paulo.
- Your prompts are forwarded, not stored.

## What's Next

We are expanding model coverage, adding image and video generation endpoints, and open-sourcing the gateway code. If you want to run your own instance, the Dockerfile is already in the repo.`,
    author: 'OMA Team',
    publishedAt: '2026-06-15',
    readingTime: 4,
    tags: ['announcement', 'inference', 'base', 'usdc'],
    featured: true,
  },
  {
    slug: 'x402-payments-guide',
    title: 'Using x402 for Per-Request AI Payments',
    excerpt:
      'A practical guide to integrating x402 payments into your AI agents. Pay per request with USDC on Base or Solana, no credit pre-funding required.',
    content: `## What is x402?

x402 is a protocol that turns HTTP 402 Payment Required into a first-class payment mechanism. Instead of pre-funding credits, your agent pays per request using EIP-3009 gasless transfers on Base or Solana.

## The Flow

1. Your agent sends a request without payment headers
2. OMA returns 402 with payment requirements in the \`Pay-Req\` header
3. Your agent signs a gasless USDC transfer
4. Retry with the \`PAYMENT-SIGNATURE\` header
5. Request succeeds

## Code Example

\`\`\`typescript
import { x402Fetch } from '@oma-ai/x402';

const res = await x402Fetch(
  'https://api.oma-ai.com/v1/chat/completions',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b',
      messages: [{ role: 'user', content: 'Hello' }],
    }),
  },
  { account, network: 'base' }
);
\`\`\`

## When to Use x402 vs Credits

- **x402**: Best for agents, sporadic usage, or when you want to avoid managing balances.
- **Credits**: Best for predictable workloads, higher rate limits, and bulk discounts.`,
    author: 'OMA Team',
    publishedAt: '2026-06-20',
    readingTime: 6,
    tags: ['x402', 'payments', 'agents', 'tutorial'],
    featured: true,
  },
  {
    slug: 'model-routing-deep-dive',
    title: 'How OMA Routes Between Model Providers',
    excerpt:
      'A technical deep dive into our circuit-breaker-based provider selection, health monitoring, and failover logic that keeps inference available.',
    content: `## The Routing Problem

Upstream providers go down. Models get deprecated. Latency spikes. A naive round-robin is not enough when you are forwarding production traffic.

## Our Approach

### Health Monitoring

Every provider is pinged on a sliding window. We track:
- P50 / P99 latency
- Error rate (5xx, timeout, malformed response)
- Token throughput
- Cost per token

### Circuit Breaker

When a provider crosses error-rate or latency thresholds, its circuit opens. Traffic is shed to healthy providers. The circuit half-opens after a cooldown to test recovery.

### Provider Selection

For each request, we score available providers by:
1. **Availability** (circuit state)
2. **Latency** (recent p50)
3. **Cost** (per-token price)
4. **Capability match** (model supports streaming? tools? JSON mode?)

The highest-scoring provider wins. Ties are broken by lowest latency.

## Failover in Practice

When Venice is at capacity, we automatically fail over to backup providers. The client sees no interruption; only a slightly different \`model\` field in the response.

## What's Next

We are building provider-agnostic streaming aggregation, where multiple providers serve the same request and the fastest response wins.`,
    author: 'OMA Team',
    publishedAt: '2026-06-25',
    readingTime: 8,
    tags: ['engineering', 'routing', 'reliability', 'deep-dive'],
  },
  {
    slug: 'crypto-payments-explained',
    title: 'Crypto Payments for AI: A Developer Guide',
    excerpt:
      'Everything you need to know about paying for AI inference with crypto. USDC on Base, wallet auth, and why we chose this path.',
    content: `## Why Crypto?

Traditional payment rails are slow, expensive, and exclude most of the world. A developer in Nigeria should be able to call an AI API as easily as one in San Francisco.

## USDC on Base

We chose Base for settlement because:
- Sub-second finality
- pennies in gas fees
- Native USDC (not bridged)
- Growing developer ecosystem

## Wallet Auth (SIWE)

Instead of passwords, you authenticate with your wallet via Sign-In with Ethereum (SIWE). This gives us:
- No password database to breach
- One-click auth with MetaMask, Rainbow, or any WalletConnect wallet
- Cryptographic proof of identity

## Deposits

1. Connect your wallet
2. Choose deposit amount
3. Approve USDC transfer
4. Credits are minted instantly

Withdrawals are processed on-chain with a 24-hour security window.

## The Future

We are exploring Solana USDC, cross-chain deposits via Houdini Swap, and programmatic x402 payments for autonomous agents.`,
    author: 'OMA Team',
    publishedAt: '2026-06-22',
    readingTime: 5,
    tags: ['crypto', 'payments', 'usdc', 'base', 'guide'],
  },
]

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug)
}

export function getAllTags(): string[] {
  const tags = new Set<string>()
  for (const post of BLOG_POSTS) {
    for (const tag of post.tags) {
      tags.add(tag)
    }
  }
  return Array.from(tags).sort()
}
