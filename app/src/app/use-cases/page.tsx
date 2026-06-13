import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Use Cases',
  description: 'Explore what OMA can build for you — AI agents, apps, and chatbots.',
}

const useCases = [
  {
    title: 'AI Agents',
    description: 'Autonomous agents that reason, plan, and act — chaining tools and APIs to accomplish complex workflows.',
    href: '/use-cases/ai-agents',
  },
  {
    title: 'Apps',
    description: 'Full-stack applications built from a prompt — from internal dashboards to customer-facing products.',
    href: '/use-cases/apps',
  },
  {
    title: 'Chatbots',
    description: 'Conversational interfaces powered by your data — support bots, onboarding flows, and knowledge assistants.',
    href: '/use-cases/chatbots',
  },
]

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
          style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontWeight: 600,
            lineHeight: 1.2,
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
            marginBottom: '3.5rem',
          }}
        >
          From idea to working software — pick a category to see the patterns, code, and pricing.
        </p>

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