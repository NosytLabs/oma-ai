'use client'

import { useState, useEffect, useRef, ReactNode, useId } from 'react'
import Link from 'next/link'
import {
  BookOpen, Key, Gauge, Copy, Check, Terminal, Shield, Zap,
  Lock, AlertCircle, DollarSign, Menu, X, ChevronRight, Play,
  Package, HardDrive, CheckCircle2
} from 'lucide-react'

/* ==================== TYPES ==================== */

type Tab = { label: string; lang: string; code: string }

type PlanLimits = {
  name: string
  rpm: number
  tpm: number
  concurrent: number
  color: string
  badge: string
}

type ModelPricing = {
  id: string
  name: string
  input: number
  output: number
  ctx: string
}

type EndpointInfo = {
  method: 'GET' | 'POST'
  path: string
  title: string
  desc: string
  auth: string
  body?: Record<string, string>
  params?: { name: string; type: string; desc: string }[]
  response: string
}

type ErrorInfo = {
  code: number
  type: string
  desc: string
}

/* ==================== DATA ==================== */

const PLAN_LIMITS: PlanLimits[] = [
  { name: 'Free', rpm: 60, tpm: 60000, concurrent: 5, color: 'text-[var(--color-text-secondary)]', badge: 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]' },
  { name: 'Starter', rpm: 120, tpm: 120000, concurrent: 10, color: 'text-[var(--color-accent)]', badge: 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' },
  { name: 'Pro', rpm: 300, tpm: 300000, concurrent: 25, color: 'text-[var(--color-tertiary)]', badge: 'bg-[var(--color-tertiary)]/20 text-[var(--color-tertiary)]' },
  { name: 'Business', rpm: 1000, tpm: 1000000, concurrent: 100, color: 'text-[var(--color-warning)]', badge: 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]' },
]

const MODEL_PRICING: ModelPricing[] = [
  { id: 'claude-opus-4', name: 'Claude Opus 4', input: 15.00, output: 75.00, ctx: '200K' },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', input: 3.00, output: 15.00, ctx: '200K' },
  { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', input: 3.00, output: 15.00, ctx: '200K' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', input: 1.25, output: 10.00, ctx: '1M' },
  { id: 'gemini-2.5-pro-thinking', name: 'Gemini 2.5 Pro (thinking)', input: 1.25, output: 10.00, ctx: '1M' },
  { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', input: 0.80, output: 4.00, ctx: '200K' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', input: 0.075, output: 0.30, ctx: '1M' },
  { id: 'gemini-2.5-flash-thinking', name: 'Gemini 2.5 Flash (thinking)', input: 0.075, output: 0.30, ctx: '1M' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', input: 0.15, output: 0.60, ctx: '128K' },
  { id: 'deepseek-v3', name: 'DeepSeek V3', input: 0.50, output: 1.50, ctx: '64K' },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', input: 0.35, output: 0.90, ctx: '8K' },
  { id: 'llama-3.3-70b-together', name: 'Llama 3.3 70B (Together)', input: 0.35, output: 0.90, ctx: '8K' },
  { id: 'llama-3.2-3b', name: 'Llama 3.2 3B', input: 0.06, output: 0.12, ctx: '8K' },
  { id: 'free/gpt-3.5-turbo', name: 'GPT-3.5 Turbo (FREE)', input: 0, output: 0, ctx: '16K' },
  { id: 'free/claude-3-haiku', name: 'Claude 3 Haiku (FREE)', input: 0, output: 0, ctx: '200K' },
  { id: 'free/gemini-pro', name: 'Gemini Pro (FREE)', input: 0, output: 0, ctx: '32K' },
  { id: 'free/llama-3-8b', name: 'Llama 3 8B (FREE)', input: 0, output: 0, ctx: '8K' },
]

const ENDPOINTS: EndpointInfo[] = [
  {
    method: 'POST', path: '/v1/chat/completions', title: 'Chat Completions',
    desc: 'Sends a multi-turn conversation to a chat model and returns a completion.',
    auth: 'Bearer token',
    body: {
      model: 'string (required) - Model ID e.g. "oma/llama-3.2-3b"',
      messages: 'ChatMessage[] (required) - Array of {role, content}',
      temperature: 'number (0-2, default: 0.7)',
      max_tokens: 'integer - Max tokens to generate',
      stream: 'boolean (default: false) - Enable SSE streaming',
      top_p: 'number (0-1)',
      frequency_penalty: 'number (-2 to 2)',
      presence_penalty: 'number (-2 to 2)',
    },
    response: `{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1717194000,
  "model": "oma/llama-3.2-3b",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you today?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 18,
    "completion_tokens": 12,
    "total_tokens": 30
  }
}`,
  },
  {
    method: 'POST', path: '/v1/completions', title: 'Completions (Legacy)',
    desc: 'Legacy prompt-based completion endpoint. Use Chat Completions for new projects.',
    auth: 'Bearer token',
    body: {
      model: 'string (required)',
      prompt: 'string (required)',
      max_tokens: 'integer',
      temperature: 'number (0-2)',
      top_p: 'number',
      stop: 'string | string[]',
    },
    response: `{
  "id": "cmpl-abc123",
  "object": "text_completion",
  "choices": [{
    "text": " in a land far, far away...",
    "index": 0,
    "finish_reason": "length"
  }],
  "usage": { "prompt_tokens": 5, "completion_tokens": 10, "total_tokens": 15 }
}`,
  },
  {
    method: 'GET', path: '/v1/models', title: 'List Models',
    desc: 'Returns a list of all available models. No authentication required.',
    auth: 'None',
    response: `{
  "object": "list",
  "data": [
    {"id": "oma/llama-3.2-3b", "object": "model", "owned_by": "meta"},
    {"id": "oma/deepseek-v3", "object": "model", "owned_by": "deepseek"}
  ]
}`,
  },
  {
    method: 'POST', path: '/v1/embeddings', title: 'Embeddings (Venice)',
    desc: 'Generates vector embeddings for text using Venice embedding models.',
    auth: 'Bearer token',
    body: {
      model: 'string (required) - e.g. "venice-embed-256"',
      input: 'string | string[] (required)',
      encoding_format: 'string ("base64" or "float")',
    },
    response: `{
  "object": "list",
  "data": [{
    "object": "embedding",
    "index": 0,
    "embedding": [0.0023, -0.0091, 0.0027, ...]
  }],
  "model": "venice-embed-256",
  "usage": { "prompt_tokens": 10, "total_tokens": 10 }
}`,
  },
  {
    method: 'POST', path: '/v1/images/generations', title: 'Image Generation (Venice)',
    desc: 'Generates images from text prompts using Venice FLUX models.',
    auth: 'Bearer token',
    body: {
      model: 'string (required) - e.g. "venice/flux-schnell"',
      prompt: 'string (required)',
      n: 'integer (1-4, default: 1)',
      size: 'string ("1024x1024", "512x512", etc.)',
      negative_prompt: 'string (optional)',
    },
    response: `{
  "created": 1717194000,
  "data": [{
    "url": "https://api.oma-ai.com/v1/files/img_abc123.png",
    "revised_prompt": "A cat wearing a hat"
  }]
}`,
  },
]

const ERROR_CODES: ErrorInfo[] = [
  { code: 400, type: 'bad_request', desc: 'Malformed request body or invalid parameters.' },
  { code: 401, type: 'unauthorized', desc: 'Missing or invalid API key.' },
  { code: 402, type: 'payment_required', desc: 'Insufficient credits. Deposit more or use x402 pay-per-request.' },
  { code: 429, type: 'rate_limited', desc: 'Rate limit exceeded. Retry after X-RateLimit-Reset seconds.' },
  { code: 500, type: 'internal_error', desc: 'Unexpected server error. Contact support if persistent.' },
  { code: 503, type: 'service_unavailable', desc: 'All upstream providers down. Try again shortly.' },
]

const NAV_ITEMS = [
  { id: 'quickstart', label: 'Quick Start', icon: Play },
  { id: 'authentication', label: 'Authentication', icon: Key },
  { id: 'endpoints', label: 'Endpoints Reference', icon: Terminal },
  { id: 'rate-limits', label: 'Rate Limits', icon: Gauge },
  { id: 'pricing', label: 'Pricing', icon: DollarSign },
  { id: 'x402', label: 'x402 Payments', icon: Zap },
  { id: 'sdks', label: 'SDK Installation', icon: Package },
  { id: 'errors', label: 'Error Codes', icon: AlertCircle },
]

const QUICK_START_STEPS = [
  { n: '1', title: 'Get API Key', desc: 'Create an account and generate your API key from the dashboard.' },
  { n: '2', title: 'Add to Headers', desc: 'Include your key in the Authorization header: Bearer oma_sk_...' },
  { n: '3', title: 'Start Building', desc: 'Use the OpenAI SDK with base_url=https://api.oma-ai.com/v1' },
]

/* ==================== HELPERS ==================== */

function fmt(n: number): string {
  if (n === 0) return '$0.00'
  if (n < 0.01) return '$0.01'
  return `$${n.toFixed(2)}`
}

/* ==================== COMPONENTS ==================== */

function CopyButton({ text, id }: { text: string; id: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="absolute right-3 top-3 rounded-lg border border-[var(--color-border)]/50 bg-[var(--color-surface)]/80 p-1.5 text-[var(--color-text-muted)] backdrop-blur-sm transition-all hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)] active:scale-95"
      aria-label={copied ? 'Copied' : 'Copy code'}
      aria-controls={id}
    >
      {copied ? <Check className="h-4 w-4 text-[var(--color-green)]" /> : <Copy className="h-4 w-4" />}
    </button>
  )
}

function CodeBlock({ code, title }: { code: string; title?: string }) {
  const id = useId()
  return (
    <div className="group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
      {title && (
        <div className="flex items-center justify-between border-b border-[var(--color-border)]/50 px-4 py-2">
          <span className="text-xs font-medium text-[var(--color-text-muted)] font-mono">{title}</span>
        </div>
      )}
      <CopyButton text={code} id={id} />
      <pre id={id} className="overflow-x-auto p-4 text-sm leading-relaxed"><code className="font-mono text-[var(--color-text-secondary)]">{code}</code></pre>
    </div>
  )
}

function TabbedCode({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0)
  const id = useId()
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
      <div className="flex border-b border-[var(--color-border)]/50">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setActive(i)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
              i === active ? 'text-[var(--color-accent)] border-[var(--color-accent)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <CopyButton text={tabs[active].code} id={id} />
        <pre id={id} className="overflow-x-auto p-4 text-sm leading-relaxed"><code className="font-mono text-[var(--color-text-secondary)]">{tabs[active].code}</code></pre>
      </div>
    </div>
  )
}

function SectionHeading({ id, icon, title, subtitle }: { id: string; icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div id={id} className="mb-6 flex items-start gap-4 scroll-mt-24">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20">
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-bold text-[var(--color-text)] font-syne">{title}</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p>
      </div>
    </div>
  )
}

function AnimatedSection({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el) } }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} className={`transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

/* ==================== SECTIONS ==================== */

function QuickStartSection() {
  const curlCode = `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "oma/llama-3.2-3b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`

  return (
    <AnimatedSection>
      <SectionHeading id="quickstart" icon={<Play className="h-5 w-5" />} title="Quick Start"
        subtitle="Get up and running with the OMA API in under a minute." />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {QUICK_START_STEPS.map((step) => (
          <div key={step.n} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-5">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-sm font-bold font-mono">
              {step.n}
            </div>
            <h3 className="mb-1 font-semibold text-[var(--color-text)]">{step.title}</h3>
            <p className="text-sm text-[var(--color-text-muted)]">{step.desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-[var(--color-accent)]" />
            <span className="text-sm font-medium text-[var(--color-text)]">Your First Request</span>
          </div>
          <span className="rounded-md bg-[var(--color-accent)]/10 px-2 py-0.5 text-xs font-mono text-[var(--color-accent)] border border-[var(--color-accent)]/20">cURL</span>
        </div>
        <CopyButton text={curlCode} id="quickstart-code" />
        <pre id="quickstart-code" tabIndex={0} className="overflow-x-auto text-sm font-mono text-[var(--color-text-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"><code>{curlCode}</code></pre>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-3">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Base URL</div>
          <code className="text-sm text-[var(--color-accent)]">https://api.oma-ai.com/v1</code>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-3">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">SDK Install</div>
          <code className="text-sm text-[var(--color-accent)]">npm install openai</code>
        </div>
      </div>
    </AnimatedSection>
  )
}

function AuthenticationSection() {
  const pythonCode = `from openai import OpenAI
client = OpenAI(
    api_key="oma_sk_your_key_here",
    base_url="https://api.oma-ai.com/v1"
)
response = client.chat.completions.create(
    model="oma/llama-3.2-3b",
    messages=[{"role": "user", "content": "Hello!"}]
)`

  const jsCode = `import OpenAI from "openai";
const client = new OpenAI({
  apiKey: "oma_sk_your_key_here",
  baseURL: "https://api.oma-ai.com/v1"
});
const response = await client.chat.completions.create({
  model: "oma/llama-3.2-3b",
  messages: [{ role: "user", content: "Hello!" }]
});`

  const goCode = `package main
import (
    openai "github.com/sashabaranov/go-openai"
)
func main() {
    client := openai.New("oma_sk_your_key_here")
    client.BaseURL = "https://api.oma-ai.com/v1"
}`

  return (
    <AnimatedSection delay={100}>
      <SectionHeading id="authentication" icon={<Key className="h-5 w-5" />} title="Authentication"
        subtitle="All inference endpoints require a Bearer token API key in the Authorization header." />

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5 mb-6">
        <div className="mb-3 text-sm text-[var(--color-text-muted)]">Authorization Header</div>
        <div className="rounded-lg bg-[var(--color-surface)]/80 border border-[var(--color-border)]/50 p-3 font-mono text-sm">
          <span className="text-[var(--color-warning)]">Authorization:</span> <span className="text-[var(--color-accent)]">Bearer oma_sk_...</span>
        </div>
      </div>

      <TabbedCode tabs={[
        { label: 'cURL', lang: 'bash', code: `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"oma/llama-3.2-3b","messages":[{"role":"user","content":"Hello"}]}'` },
        { label: 'Python', lang: 'python', code: pythonCode },
        { label: 'JavaScript', lang: 'javascript', code: jsCode },
        { label: 'Go', lang: 'go', code: goCode },
      ]} />

      <div className="mt-6 rounded-xl border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5 p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-[var(--color-warning)] mt-0.5" />
          <div>
            <h4 className="font-semibold text-[var(--color-warning)]">API Key Security</h4>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Keys use the <code className="text-[var(--color-warning)] font-mono">oma_sk_</code> prefix. Only the SHA-256 hash is stored. Keep your key secret and never commit it to version control.
            </p>
          </div>
        </div>
      </div>
    </AnimatedSection>
  )
}

function EndpointsSection() {
  const [expanded, setExpanded] = useState<string | null>('/v1/chat/completions')

  return (
    <AnimatedSection delay={200}>
      <SectionHeading id="endpoints" icon={<Terminal className="h-5 w-5" />} title="Endpoints Reference"
        subtitle="OpenAI-compatible REST API endpoints." />

      <div className="space-y-4">
        {ENDPOINTS.map(ep => (
          <div key={ep.path} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === ep.path ? null : ep.path)}
              className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-[var(--color-surface)]/80"
            >
              <div className="flex items-center gap-3">
                <span className={`rounded-md px-2.5 py-1 font-mono text-xs font-bold uppercase ${
                  ep.method === 'GET' ? 'bg-[var(--color-green)]/10 text-[var(--color-green)]' : 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                }`}>
                  {ep.method}
                </span>
                <code className="font-mono text-sm text-[var(--color-text)]">{ep.path}</code>
              </div>
              <div className="flex items-center gap-2">
                {ep.method === 'POST' && (
                  <span className="flex items-center gap-1.5 rounded-full bg-[var(--color-surface)] px-2.5 py-0.5 text-xs text-[var(--color-text-muted)] border border-[var(--color-border)]">
                    <Lock className="h-3 w-3" /> Auth
                  </span>
                )}
                <ChevronRight className={`h-4 w-4 text-[var(--color-text-muted)] transition-transform ${expanded === ep.path ? 'rotate-90' : ''}`} />
              </div>
            </button>

            {expanded === ep.path && (
              <div className="border-t border-[var(--color-border)] p-4 space-y-4">
                <p className="text-sm text-[var(--color-text-muted)]">{ep.desc}</p>

                {ep.body && (
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Request Body</h4>
                    <div className="rounded-lg border border-[var(--color-border)]/50 bg-[var(--color-panel)] p-4 space-y-2">
                      {Object.entries(ep.body).map(([key, val]) => (
                        <div key={key} className="flex gap-3 font-mono text-sm">
                          <span className="text-[var(--color-accent)] shrink-0">{key}</span>
                          <span className="text-[var(--color-text-muted)]">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Response</h4>
                  <CodeBlock code={ep.response} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </AnimatedSection>
  )
}

function RateLimitsSection() {
  return (
    <AnimatedSection delay={300}>
      <SectionHeading id="rate-limits" icon={<Gauge className="h-5 w-5" />} title="Rate Limits"
        subtitle="Per-plan request and token limits with burst handling." />

      <div className="mb-6 overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/50">
              <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Plan</th>
              <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-right">RPM</th>
              <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-right">TPM</th>
              <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-right">Concurrent</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_LIMITS.map((p, i) => (
              <tr key={p.name} className={`border-b border-[var(--color-border)]/50 ${i % 2 === 1 ? 'bg-[var(--color-surface)]/30' : ''}`}>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${p.badge}`}>
                    {p.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-[var(--color-text-secondary)]">{p.rpm.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono text-[var(--color-text-secondary)]">{p.tpm.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono text-[var(--color-text-secondary)]">{p.concurrent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-4">
          <h4 className="mb-2 font-semibold text-[var(--color-text)]">Burst Handling</h4>
          <p className="text-sm text-[var(--color-text-muted)]">
            Token bucket algorithm allows short bursts above the sustained rate. Excess tokens are spilled into the next window.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-4">
          <h4 className="mb-2 font-semibold text-[var(--color-text)]">Rate Limit Headers</h4>
          <div className="space-y-1 font-mono text-xs text-[var(--color-text-muted)]">
            <div><span className="text-[var(--color-accent)]">X-RateLimit-Limit</span> - Requests per minute</div>
            <div><span className="text-[var(--color-accent)]">X-RateLimit-Remaining</span> - Requests left</div>
            <div><span className="text-[var(--color-accent)]">X-RateLimit-Reset</span> - Seconds until reset</div>
          </div>
        </div>
      </div>
    </AnimatedSection>
  )
}

function PricingSection() {
  return (
    <AnimatedSection delay={400}>
      <SectionHeading id="pricing" icon={<DollarSign className="h-5 w-5" />} title="Pricing"
        subtitle="Per-model pricing. Input and output priced per million tokens." />

      <div className="mb-6 rounded-xl border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/50">
              <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Model</th>
              <th className="px-4 py-3 text-right font-medium text-[var(--color-text-muted)]">Input / 1M</th>
              <th className="px-4 py-3 text-right font-medium text-[var(--color-text-muted)]">Output / 1M</th>
              <th className="px-4 py-3 text-right font-medium text-[var(--color-text-muted)]">Context</th>
            </tr>
          </thead>
          <tbody>
            {MODEL_PRICING.map((m, i) => (
              <tr key={m.id} className={`border-b border-[var(--color-border)]/50 ${i % 2 === 1 ? 'bg-[var(--color-surface)]/30' : ''}`}>
                <td className="px-4 py-3 font-medium text-[var(--color-text)]">{m.name}</td>
                <td className="px-4 py-3 text-right font-mono text-[var(--color-accent)]">{fmt(m.input)}</td>
                <td className="px-4 py-3 text-right font-mono text-[var(--color-text-secondary)]">{fmt(m.output)}</td>
                <td className="px-4 py-3 text-right text-[var(--color-text-muted)]">{m.ctx}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 p-4">
        <h4 className="font-semibold text-[var(--color-accent)]">Credit Deduction</h4>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--color-accent)] mt-0.5" />
            <span className="text-sm text-[var(--color-text-muted)]">$1 = $1. Billed per token in real-time.</span>
          </div>

          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--color-accent)] mt-0.5" />
            <span className="text-sm text-[var(--color-text-muted)]">No minimums or subscriptions</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--color-accent)] mt-0.5" />
            <span className="text-sm text-[var(--color-text-muted)]">12-month rolling expiry</span>
          </div>
        </div>
      </div>
    </AnimatedSection>
  )
}

function X402Section() {
  const flowCode = `# 1. Request without credits - get 402
curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_agent_key" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"llama-3.3-70b","messages":[{"role":"user","content":"Hello"}]}'

# Response: 402 Payment Required
# x-payment: {"address": "0x...", "chain": "base", "amount": "0.00025", "symbol": "USDC"}

# 2. Pay via x402 (agent pays gasless)
# SDK handles the payment flow automatically

# 3. Request with payment proof - SUCCESS
curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_agent_key" \\
  -H "Content-Type: application/json" \\
  -H "x-payment-proof: base64-proof-from-facilitator" \\
  -d '{"model":"llama-3.3-70b","messages":[{"role":"user","content":"Hello"}]}'`

  const agentCode = `# Agent-native payments with x402
import { OpenAI } from 'openai';

const client = new OpenAI({
  apiKey: process.env.OMA_AGENT_KEY,
  baseURL: 'https://api.oma-ai.com/v1',
  x402: true, // Enable auto-pay per request
});

const response = await client.chat.completions.create({
  model: 'llama-3.3-70b',
  messages: [{ role: 'user', content: 'Write a smart contract' }],
});

// Payment is handled automatically per-request
// No credit pre-funding required`

  return (
    <AnimatedSection delay={450}>
      <SectionHeading id="x402" icon={<Zap className="h-5 w-5" />} title="x402 Payments"
        subtitle="Native HTTP 402 payments for AI agents. Pay per request, no credit pre-funding." />

      <div className="rounded-xl border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5 p-4 mb-6">
        <div className="flex items-start gap-3">
          <Zap className="h-5 w-5 text-[var(--color-warning)] mt-0.5" />
          <div>
            <h4 className="font-semibold text-[var(--color-warning)]">Venice x402 Protocol</h4>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              x402 enables gasless AI inference payments on Solana and Base. When credits are exhausted,
              the API returns HTTP 402 with payment details. Agents can pay directly without pre-funding.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="mb-3 text-sm font-semibold text-[var(--color-text)]">402 Payment Flow</h4>
        <CodeBlock code={flowCode} />
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-5">
        <h4 className="mb-3 font-semibold text-[var(--color-text)]">For AI Agents</h4>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Enable <code className="text-[var(--color-accent)] font-mono">x402: true</code> in the SDK to pay per request automatically.
          Ideal for agents that make sporadic API calls and do not want to manage credit balances.
        </p>
        <CodeBlock code={agentCode} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-4">
          <h4 className="mb-2 font-semibold text-[var(--color-text)]">Benefits</h4>
          <ul className="space-y-1.5 text-sm text-[var(--color-text-muted)]">
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-[var(--color-accent)] mt-0.5 shrink-0" /> No credit pre-funding</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-[var(--color-accent)] mt-0.5 shrink-0" /> Gasless on Solana/Base</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-[var(--color-accent)] mt-0.5 shrink-0" /> Per-request billing</li>
          </ul>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-4">
          <h4 className="mb-2 font-semibold text-[var(--color-text)]">Supported Chains</h4>
          <ul className="space-y-1.5 text-sm text-[var(--color-text-muted)]">
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-[var(--color-green)] mt-0.5 shrink-0" /> Base (USDC)</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-[var(--color-green)] mt-0.5 shrink-0" /> Solana (USDC)</li>
          </ul>
        </div>
      </div>
    </AnimatedSection>
  )
}

function SDKsSection() {
  const pythonCode = `# Install: pip install openai
from openai import OpenAI
client = OpenAI(
    api_key="oma_sk_your_key_here",
    base_url="https://api.oma-ai.com/v1"
)
response = client.chat.completions.create(
    model="oma/llama-3.2-3b",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`

  const jsCode = `// Install: npm install openai
import OpenAI from "openai";
const client = new OpenAI({
  apiKey: "oma_sk_your_key_here",
  baseURL: "https://api.oma-ai.com/v1"
});
const response = await client.chat.completions.create({
  model: "oma/llama-3.2-3b",
  messages: [{ role: "user", content: "Hello!" }]
});`

  const curlCode = `# Install: pip install requests
import requests
response = requests.post(
    "https://api.oma-ai.com/v1/chat/completions",
    headers={
        "Authorization": "Bearer oma_sk_your_key_here",
        "Content-Type": "application/json"
    },
    json={
        "model": "oma/llama-3.2-3b",
        "messages": [{"role": "user", "content": "Hello!"}]
    }
)
print(response.json())`

  return (
    <AnimatedSection delay={500}>
      <SectionHeading id="sdks" icon={<Package className="h-5 w-5" />} title="SDK Installation"
        subtitle="Use the OpenAI SDK with OMA as the base URL." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-[var(--color-accent)]" />
            <span className="font-mono text-sm text-[var(--color-text)]">npm</span>
          </div>
          <code className="text-sm text-[var(--color-accent)]">npm install openai</code>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-[var(--color-accent)]" />
            <span className="font-mono text-sm text-[var(--color-text)]">pip</span>
          </div>
          <code className="text-sm text-[var(--color-accent)]">pip install openai</code>
        </div>
      </div>

      <TabbedCode tabs={[
        { label: 'Python', lang: 'python', code: pythonCode },
        { label: 'JavaScript', lang: 'javascript', code: jsCode },
        { label: 'cURL', lang: 'bash', code: curlCode },
      ]} />

      <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-4">
        <h4 className="mb-3 font-semibold text-[var(--color-text)]">Vercel AI SDK</h4>
        <CodeBlock code={`import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
const oma = createOpenAI({ baseURL: 'https://api.oma-ai.com/v1', apiKey: 'oma_sk_...' });
const { text } = await generateText({ model: oma('oma/llama-3.2-3b'), prompt: 'Hello!' });`} />
      </div>
    </AnimatedSection>
  )
}

function ErrorsSection() {
  const retryCode = `import time
from openai import OpenAI
client = OpenAI(api_key="oma_sk_...", base_url="https://api.oma-ai.com/v1")
for attempt in range(5):
    try:
        response = client.chat.completions.create(model="oma/llama-3.2-3b", messages=[{"role": "user", "content": "Hi"}])
        break
    except Exception as e:
        if hasattr(e, 'status_code') and e.status_code == 429:
            time.sleep(2 ** attempt)
        else:
            raise`

  return (
    <AnimatedSection delay={600}>
      <SectionHeading id="errors" icon={<AlertCircle className="h-5 w-5" />} title="Error Codes"
        subtitle="Standard HTTP status codes returned by the API." />

      <div className="mb-6 overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/50">
              <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Code</th>
              <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Type</th>
              <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Description</th>
            </tr>
          </thead>
          <tbody>
            {ERROR_CODES.map(e => (
              <tr key={e.code} className="border-b border-[var(--color-border)]/50">
                <td className="px-4 py-3 font-mono font-bold text-[var(--color-error)]">{e.code}</td>
                <td className="px-4 py-3 font-mono text-[var(--color-warning)]">{e.type}</td>
                <td className="px-4 py-3 text-[var(--color-text-muted)]">{e.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
        <h4 className="mb-3 font-semibold text-[var(--color-text)]">Handling Rate Limits</h4>
        <CopyButton text={retryCode} id="retry-code" />
        <pre id="retry-code" tabIndex={0} className="overflow-x-auto text-sm font-mono text-[var(--color-text-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"><code>{retryCode}</code></pre>
      </div>
    </AnimatedSection>
  )
}

/* ==================== SIDEBAR ==================== */

function Sidebar({ activeId }: { activeId: string }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileNavId = useId()

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-void)] shadow-lg lg:hidden"
        aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={mobileOpen}
        aria-controls={mobileNavId}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileOpen && (
        <button className="fixed inset-0 z-40 bg-[var(--color-void)]/80 backdrop-blur-sm lg:hidden cursor-default" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu" />
      )}

      <aside id={mobileNavId} aria-label="Mobile navigation" className={`fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-void)] transition-transform lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-4">
          <div className="mb-4 rounded-xl bg-[var(--color-accent)]/10 p-3 border border-[var(--color-accent)]/20">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[var(--color-accent)]" />
              <span className="text-sm font-semibold text-[var(--color-accent)]">OMA API</span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">v1.0.0</p>
          </div>

          <nav className="space-y-1" aria-label="Documentation navigation">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon
              const isActive = activeId === item.id
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 min-h-[48px] text-sm transition-all ${
                    isActive
                      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </a>
              )
            })}
          </nav>
        </div>
      </aside>
    </>
  )
}

/* ==================== PAGE ==================== */

function DocsContent() {
  const [activeId, setActiveId] = useState('quickstart')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        })
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    NAV_ITEMS.forEach(item => {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen">
      <Sidebar activeId={activeId} />

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-void)]/80 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-0.5">
                  <Link href="/" className="hover:text-[var(--color-text)] transition-colors">Home</Link>
                  <span className="opacity-50">›</span>
                  <span className="text-[var(--color-text-secondary)]">Developer Portal</span>
                  <span className="opacity-50">›</span>
                  <span className="text-[var(--color-text)]">API Docs</span>
                </nav>
                <h1 className="font-semibold text-[var(--color-text)] text-sm">OMA AI Gateway Documentation</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/playground"
                className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-void)] transition-colors hover:bg-[var(--color-accent-hover)]"
              >
                <Play className="h-4 w-4" />
                Playground
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-4xl font-bold tracking-tight text-[var(--color-text)] font-syne mb-3">
              OMA API Documentation
            </h2>
            <p className="text-lg text-[var(--color-text-muted)]">
              OpenAI-compatible AI inference gateway with crypto payments. Access 19+ models with unified API.
            </p>
          </div>

          <div className="space-y-16">
            <QuickStartSection />
            <AuthenticationSection />
            <EndpointsSection />
            <RateLimitsSection />
            <PricingSection />
            <X402Section />
            <SDKsSection />
            <ErrorsSection />
          </div>

          </main>
      </div>
    </div>
  )
}

export default function DocsPage() {
  return <DocsContent />
}