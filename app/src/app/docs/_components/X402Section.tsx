// ponytail: production URL (https://api.oma-ai.com/v1) — references resolve once the gateway is deployed (audit C-1).
'use client'

import { Zap, CheckCircle2, Coins, Network, FileCode2, ArrowRight } from 'lucide-react'
import { SectionHeading, AnimatedSection, SubHeading, CodeBlock } from './SharedComponents'

export function X402Section() {
  const flowCode = `# 1. Request without credits — server returns 402
curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_agent_key" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"llama-3.3-70b","messages":[{"role":"user","content":"Hello"}]}'

# Response: 402 Payment Required
# PAYMENT-REQUIRED: {"chain":"base","amount":"25000","payTo":"0x...","asset":"USDC"}

# 2. Agent signs an EIP-3009 transferWithAuthorization off-chain (gasless)
# The SDK does this for you when x402: true is set

# 3. Retry with the signed payment attached
curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_agent_key" \\
  -H "Content-Type: application/json" \\
  -H "PAYMENT-SIGNATURE: <base64-encoded-signed-payload>" \\
  -d '{"model":"llama-3.3-70b","messages":[{"role":"user","content":"Hello"}]}'`

  const agentCode = `// Agent-native payments with x402
import { OpenAI } from 'openai';

const client = new OpenAI({
  apiKey: process.env.OMA_AGENT_KEY,
  baseURL: 'https://api.oma-ai.com/v1',
  defaultHeaders: { 'X-OMA-X402': 'true' },
});

const response = await client.chat.completions.create({
  model: 'llama-3.3-70b',
  messages: [{ role: 'user', content: 'Write a smart contract' }],
});

// If credits are insufficient, the API returns HTTP 402
// with payment details in the PAYMENT-REQUIRED header.
// The client signs an EIP-3009 transferWithAuthorization
// off-chain and retries with the PAYMENT-SIGNATURE header.`

  return (
    <AnimatedSection delay={450}>
      <SectionHeading
        id="x402"
        icon={<Zap className="h-5 w-5" />}
        title="x402 payments"
        subtitle="Native HTTP 402 payments for AI agents. Pay per request, no credit pre-funding."
        badge="Gasless"
      />

      <div className="mb-8 rounded-lg border border-warning/20 bg-gradient-to-br from-warning/8 to-transparent p-4">
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <h4 className="font-display text-sm font-semibold text-warning">
              x402 protocol
            </h4>
            <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
              x402 is an open payment standard built on the HTTP 402 status code. Clients sign
              EIP-3009 <code className="font-mono text-text-secondary">transferWithAuthorization</code> payloads off-chain and a facilitator settles USDC on Base. No accounts, no prepaid balances, no protocol fees.
            </p>
          </div>
        </div>
      </div>

      <SubHeading id="x402-what">What is x402?</SubHeading>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface/40 p-4">
          <Coins className="mb-2 h-4 w-4 text-accent" />
          <h4 className="mb-1 font-display text-sm font-semibold text-text">Per request</h4>
          <p className="text-[13px] leading-relaxed text-text-muted">
            Pay only for what you use, request by request. No top-ups.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface/40 p-4">
          <Network className="mb-2 h-4 w-4 text-accent" />
          <h4 className="mb-1 font-display text-sm font-semibold text-text">Multi-chain</h4>
          <p className="text-[13px] leading-relaxed text-text-muted">
            Settle on Base, denominated in USDC.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface/40 p-4">
          <FileCode2 className="mb-2 h-4 w-4 text-accent" />
          <h4 className="mb-1 font-display text-sm font-semibold text-text">No gas</h4>
          <p className="text-[13px] leading-relaxed text-text-muted">
            EIP-3009 off-chain signing means no native token balance needed.
          </p>
        </div>
      </div>

      <SubHeading id="x402-flow">How a payment works</SubHeading>
      <CodeBlock code={flowCode} title="402 payment flow" lang="bash" />

      <SubHeading id="x402-code">Code examples</SubHeading>
      <div className="mb-8">
        <CodeBlock code={agentCode} title="Auto-retry with x402" lang="javascript" />
      </div>

      <SubHeading id="x402-where">Where it runs</SubHeading>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface/40 p-4">
          <h4 className="mb-2 font-display text-sm font-semibold text-text">Benefits</h4>
          <ul className="space-y-1.5 text-[13px] text-text-muted">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              No credit pre-funding
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              Gasless (EIP-3009 off-chain signing)
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              Per-request billing
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              No protocol fees
            </li>
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-surface/40 p-4">
          <h4 className="mb-2 font-display text-sm font-semibold text-text">Supported chains</h4>
          <ul className="space-y-1.5 text-[13px] text-text-muted">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              <span>
                <span className="font-mono text-text-secondary">Base</span> — USDC, EIP-3009
              </span>
            </li>
          </ul>
          <a
            href="#authentication"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-accent-hover"
          >
            See the wallet example <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </AnimatedSection>
  )
}
