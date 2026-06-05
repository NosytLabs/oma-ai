import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Compare Alternatives',
  description:
    'Side-by-side comparisons of OMA AI Gateway vs other platforms: pricing, features, and capabilities.',
}

const comparisons = [
  {
    title: 'CheapTokens Alternative',
    href: '/compare/cheaptokens-alternative',
    description:
      'How OMA compares to CheapTokens on pricing, model access, and agent tooling.',
  },
  {
    title: 'OpenRouter Alternative',
    href: '/compare/openrouter-alternative',
    description:
      'OMA vs OpenRouter — unified model access with built-in agent orchestration.',
  },
  {
    title: 'Venice AI Alternative',
    href: '/compare/venice-ai-alternative',
    description:
      'OMA compared to Venice AI for privacy-first, uncensored model access.',
  },
]

export default function ComparePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--color-void)',
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
          Compare
        </p>
        <h1
          style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontWeight: 600,
            lineHeight: 1.2,
            marginBottom: '1rem',
          }}
        >
          How OMA stacks up
        </h1>
        <p
          style={{
            color: 'var(--color-text-muted)',
            marginBottom: '3rem',
            maxWidth: '36rem',
            lineHeight: 1.6,
          }}
        >
          See how OMA AI Gateway compares to other platforms.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {comparisons.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'block',
                padding: '1.5rem',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color 0.2s',
              }}
            >
              <h2
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                  color: 'var(--color-accent)',
                }}
              >
                {item.title}
              </h2>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
