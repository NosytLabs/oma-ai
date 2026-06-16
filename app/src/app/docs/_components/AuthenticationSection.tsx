'use client'

import { Key, Wallet, Hash, ShieldCheck, AlertCircle } from 'lucide-react'
import { AUTH_METHODS } from '../data'
import { SectionHeading, AnimatedSection, SubHeading, CodeBlock } from './SharedComponents'

export function AuthenticationSection() {
  const methodIcons: Record<string, typeof Key> = {
    'api-key': Key,
    'wallet-x402': Wallet,
    'account-number': Hash,
  }

  return (
    <AnimatedSection delay={100}>
      <SectionHeading
        id="authentication"
        icon={<Key className="h-5 w-5" />}
        title="Authentication"
        subtitle="Three ways in, one shape on the wire. Pick the one that fits how you want to pay."
        badge="3 methods"
      />

      <div className="mb-8 rounded-lg border border-accent/20 bg-gradient-to-br from-accent/5 to-transparent p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <h4 className="font-semibold text-accent">Pick by use case</h4>
            <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
              <span className="text-text">API key</span> for backends, scripts, and CI.{' '}
              <span className="text-text">Wallet (x402)</span> for agents and one-off requests — no account, no balance, gasless.{' '}
              <span className="text-text">Account number</span> when you want a credit balance and a paper trail.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {AUTH_METHODS.map((m) => {
          const Icon = methodIcons[m.id] ?? Key
          return (
            <article
              key={m.id}
              id={
                m.id === 'api-key' ? 'auth-key' :
                m.id === 'wallet-x402' ? 'auth-wallet' :
                'auth-account'
              }
              className="scroll-mt-24 overflow-hidden rounded-lg border border-border bg-surface/30"
            >
              <header className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-surface/40 px-5 py-3">
                <Icon className="h-4 w-4 text-accent" />
                <h3 className="font-display text-base font-semibold text-text">
                  {m.label}
                </h3>
                {m.id === 'wallet-x402' && (
                  <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-accent">
                    No account
                  </span>
                )}
                {m.id === 'account-number' && (
                  <span className="rounded-full border border-info/30 bg-info/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-info">
                    Recommended
                  </span>
                )}
              </header>
              <div className="px-5 py-4">
                <p className="mb-4 text-[13px] leading-relaxed text-text-muted">
                  {m.blurb}
                  {m.note && (
                    <span className="mt-1 block text-text-secondary">{m.note}</span>
                  )}
                </p>
                <CodeBlock code={m.example.code} title={m.example.label} lang={m.example.lang} />
              </div>
            </article>
          )
        })}
      </div>

      <SubHeading id="auth-errors">Auth errors</SubHeading>
      <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="text-[13px] leading-relaxed text-text-muted">
            <p className="font-semibold text-warning">If you get 401</p>
            <p className="mt-1">
              The key is wrong, revoked, or the{' '}
              <code className="rounded border border-warning/30 bg-panel px-1 font-mono text-[0.85em] text-warning">
                Authorization
              </code>{' '}
              header is missing the{' '}
              <code className="rounded border border-warning/30 bg-panel px-1 font-mono text-[0.85em] text-warning">
                Bearer
              </code>{' '}
              prefix. If you get <strong className="text-text">402</strong>, your account has no credits — either top up or use the x402 path. See{' '}
              <a href="#errors" className="font-medium text-accent underline-offset-2 hover:underline">
                Errors
              </a>{' '}
              for the full list.
            </p>
          </div>
        </div>
      </div>
    </AnimatedSection>
  )
}
