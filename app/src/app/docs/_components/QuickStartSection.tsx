// ponytail: production URL (https://api.oma-ai.com/v1) — references resolve once the gateway is deployed (audit C-1).
'use client'

import { Terminal, Key, Send, MessageSquare, ArrowRight } from 'lucide-react'
import { SectionHeading, AnimatedSection, SubHeading, CodeBlock } from './SharedComponents'

export function QuickStartSection() {
  const requestCode = `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.2-3b",
    "messages": [{ "role": "user", "content": "Hello" }]
  }'`

  const responseJson = `{
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
}`

  return (
    <AnimatedSection>
      <SectionHeading
        id="quickstart"
        icon={<Terminal className="h-5 w-5" />}
        title="Quickstart"
        subtitle="Three calls. No scaffolding, no SDK lock-in. Under a minute end to end."
        badge="3 steps"
      />

      <ol className="mb-10 grid gap-4 sm:grid-cols-3">
        <li
          id="qs-step-key"
          className="scroll-mt-24 rounded-lg border border-border bg-surface/40 p-5 transition-colors hover:border-border-bright/60"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-accent/30 bg-accent/15 font-mono text-xs font-bold text-accent">
              1
            </span>
            <Key className="h-4 w-4 text-text-muted" />
          </div>
          <h3 className="mb-1 text-sm font-semibold text-text">Get a key</h3>
          <p className="text-[13px] leading-relaxed text-text-muted">
            Sign in with a wallet, click <span className="text-text-secondary">Create key</span>, copy the{' '}
            <code className="rounded border border-border/60 bg-panel px-1 py-0.5 font-mono text-[0.8em] text-accent">
              oma_sk_…
            </code>{' '}
            string. We only store the SHA-256 hash, so we can&apos;t show it twice.
          </p>
        </li>
        <li
          id="qs-step-request"
          className="scroll-mt-24 rounded-lg border border-border bg-surface/40 p-5 transition-colors hover:border-border-bright/60"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-accent/30 bg-accent/15 font-mono text-xs font-bold text-accent">
              2
            </span>
            <Send className="h-4 w-4 text-text-muted" />
          </div>
          <h3 className="mb-1 text-sm font-semibold text-text">Make a request</h3>
          <p className="text-[13px] leading-relaxed text-text-muted">
            Hit the chat endpoint with your key in the{' '}
            <code className="rounded border border-border/60 bg-panel px-1 py-0.5 font-mono text-[0.8em] text-accent">
              Authorization
            </code>{' '}
            header. Same shape as OpenAI&apos;s{' '}
            <code className="font-mono text-[0.8em] text-text-secondary">
              /v1/chat/completions
            </code>
            .
          </p>
        </li>
        <li
          id="qs-step-response"
          className="scroll-mt-24 rounded-lg border border-border bg-surface/40 p-5 transition-colors hover:border-border-bright/60"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-accent/30 bg-accent/15 font-mono text-xs font-bold text-accent">
              3
            </span>
            <MessageSquare className="h-4 w-4 text-text-muted" />
          </div>
          <h3 className="mb-1 text-sm font-semibold text-text">Read the response</h3>
          <p className="text-[13px] leading-relaxed text-text-muted">
            JSON in, JSON out. The{' '}
            <code className="font-mono text-[0.8em] text-text-secondary">
              choices[0].message.content
            </code>{' '}
            field is your completion. Token usage and cost are in{' '}
            <code className="font-mono text-[0.8em] text-text-secondary">usage</code>.
          </p>
        </li>
      </ol>

      <SubHeading id="qs-step-request">Your first request</SubHeading>
      <CodeBlock code={requestCode} title="cURL · POST /v1/chat/completions" lang="bash" />

      <SubHeading id="qs-step-response">What you get back</SubHeading>
      <CodeBlock code={responseJson} title="200 OK · application/json" lang="json" />

      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-muted">
        <a
          href="#sdks"
          className="inline-flex items-center gap-1.5 font-medium text-accent transition-colors hover:text-accent-hover"
        >
          See SDK examples <ArrowRight className="h-3.5 w-3.5" />
        </a>
        <a
          href="#x402"
          className="inline-flex items-center gap-1.5 font-medium text-accent transition-colors hover:text-accent-hover"
        >
          Pay per request with x402 <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </AnimatedSection>
  )
}
