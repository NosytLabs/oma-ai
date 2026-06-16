import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Zap } from 'lucide-react'
import { MODEL_COUNT } from '@/lib/models-data'

export const metadata: Metadata = {
  title: 'Use Cases',
  description: 'Explore what OMA can build for you — AI agents, apps, and chatbots. OpenAI-compatible, USDC pricing, wallet auth.',
}

const useCases = [
  {
    title: 'AI Agents',
    description: 'Autonomous agents that reason, plan, and act — chaining tools and APIs to accomplish complex workflows. Function calling, structured outputs, and x402 per-request billing.',
    href: '/use-cases/ai-agents',
    sample: 'from openai import OpenAI\nclient = OpenAI(base_url="https://api.oma-ai.com/v1", api_key="oma_sk_...")',
  },
  {
    title: 'Apps',
    description: 'Full-stack applications built on a single OpenAI-compatible endpoint. Same code, 17 chat models, vision, image gen, and video gen behind one key.',
    href: '/use-cases/apps',
    sample: 'const c = new OpenAI({ baseURL: "https://api.oma-ai.com/v1" });',
  },
  {
    title: 'Chatbots',
    description: 'Conversational interfaces for support, sales, and onboarding. Up to 1M token context (Gemini 2.5 Pro) and streaming responses from every model.',
    href: '/use-cases/chatbots',
    sample: 'stream = client.chat.completions.create({ model: "gemini-2.5-pro", stream: true, ... });',
  },
] as const

export default function UseCasesPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-void)',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-mono, monospace)',
        padding: '4rem 1.5rem',
      }}
    >
      <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
        <p
          style={{
            color: 'var(--color-accent)',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '0.75rem',
          }}
        >
          Use Cases
        </p>
        <h1
          className="h1-page"
          style={{
            marginBottom: '1rem',
          }}
        >
          What can OMA build?
        </h1>
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: '1.05rem',
            lineHeight: 1.6,
            maxWidth: '36rem',
            marginBottom: '2rem',
          }}
        >
          From idea to working software — pick a category to see the patterns, code, and pricing. {MODEL_COUNT} chat models behind one OpenAI-compatible endpoint.
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '3.5rem',
          }}
        >
          <Link
            href="/dashboard/api-keys"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              borderRadius: '9999px',
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-text-inverse)',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 8px 24px -8px color-mix(in srgb, var(--color-accent) 50%, transparent)',
            }}
          >
            <Zap style={{ height: '1rem', width: '1rem' }} aria-hidden="true" />
            Get an API key
            <ArrowRight style={{ height: '0.875rem', width: '0.875rem' }} aria-hidden="true" />
          </Link>
          <Link
            href="/playground"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              borderRadius: '9999px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'transparent',
              color: 'var(--color-text)',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Try the playground
            <ArrowRight style={{ height: '0.875rem', width: '0.875rem' }} aria-hidden="true" />
          </Link>
          <Link
            href="/docs"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              borderRadius: '9999px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'transparent',
              color: 'var(--color-text)',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Read the docs
          </Link>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))',
            gap: '1.25rem',
          }}
        >
          {useCases.map((useCase) => (
            <Link
              key={useCase.href}
              href={useCase.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                padding: '1.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color 0.15s ease',
              }}
            >
              <h2
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 600,
                  color: 'var(--color-accent)',
                }}
              >
                {useCase.title}
              </h2>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {useCase.description}
              </p>
              <pre
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--color-text-muted)',
                  backgroundColor: 'var(--color-bg-secondary, var(--color-surface))',
                  border: '1px solid var(--color-border)',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '0.375rem',
                  margin: 0,
                  overflowX: 'auto',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                <code>{useCase.sample}</code>
              </pre>
              <span
                style={{
                  marginTop: 'auto',
                  paddingTop: '0.5rem',
                  fontSize: '0.8rem',
                  color: 'var(--color-accent)',
                  opacity: 0.7,
                }}
              >
                Explore →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}