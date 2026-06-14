'use client'
import Link from 'next/link'
import { ArrowLeft, Shield, Zap, CreditCard, Users, CheckCircle, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

export default function OpenRouterAlternativePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-xs font-mono text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Home
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
          className="mb-16"
        >
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 px-3 py-1.5">
              <Shield className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              <span className="text-xs font-mono font-semibold text-[var(--color-accent)]">Privacy-First Alternative</span>
            </div>
          </div>

          <h1 className="mb-6 font-syne text-4xl font-bold tracking-tight md:text-5xl text-[var(--color-text-bright)]">
            OpenRouter Alternative for{' '}
            <span className="gradient-text">Private AI Inference</span>
          </h1>

          <p className="max-w-2xl text-base leading-relaxed text-[var(--color-text)]">
            Tired of account requirements and data logging? OMA delivers Venice-powered AI inference with a privacy-first approach, crypto-native payments, and zero friction.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
          className="mb-16"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
            <span className="font-mono text-xs text-[var(--color-text-muted)]">{'//'} core-advantages</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              { icon: Shield, title: 'Privacy-First by Design', desc: 'Unlike OpenRouter, OMA operates with minimal data retention. Your API calls don\'t require an account, and we log only what\'s essential for service delivery.' },
              { icon: Zap, title: 'Venice-Powered Backend', desc: 'OMA routes requests through Venice, routing through Venice infrastructure and adding intelligent routing, failover, and a credit system on top.' },
              { icon: CreditCard, title: 'Crypto-Native Payments', desc: 'Pay with 100+ cryptocurrencies directly. No credit cards, no bank accounts, no financial surveillance. Just wallet-to-wallet simplicity.' },
              { icon: Users, title: 'Low-Friction Access', desc: 'Connect your wallet and start inferring in seconds. No KYC, no email verification, no waiting period. Permissionless by default.' },
            ].map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
                className="group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 transition-all hover:border-[var(--color-accent)]/30"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                    <card.icon className="h-5 w-5 text-[var(--color-accent)]" />
                  </div>
                  <div>
                    <h3 className="mb-2 font-syne text-base font-semibold text-[var(--color-text-bright)]">{card.title}</h3>
                    <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">{card.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4, ease: 'easeOut' }}
          className="mb-16"
        >
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[var(--color-border)]" />
              <h2 className="font-syne text-2xl font-bold tracking-tight text-[var(--color-text-bright)]">Why Developers Choose OMA</h2>
            </div>
          </div>

          <div className="space-y-3">
            {[
              'OpenAI-compatible API for easy migration',
              '19+ AI models including GPT-4, Claude, and Gemini',
              'Real-time credit system with full transparency',
              'No account required - wallet-only authentication',
              'Built on Base for fast, reliable transactions',
              'Dashboard for monitoring usage and costs',
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.5 + i * 0.05, ease: 'easeOut' }}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-4 transition-all hover:border-[var(--color-accent)]/30"
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10">
                  <CheckCircle className="h-3 w-3 text-[var(--color-accent)]" />
                </div>
                <span className="font-mono text-sm text-[var(--color-text)]">{feature}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6, ease: 'easeOut' }}
          className="mb-16"
        >
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[var(--color-border)]" />
              <h2 className="font-syne text-2xl font-bold tracking-tight text-[var(--color-text-bright)]">Compare: OMA vs OpenRouter</h2>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="p-4 text-left font-mono text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Feature</th>
                  <th className="p-4 text-center font-mono text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">OpenRouter</th>
                  <th className="p-4 text-center font-mono text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">OMA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {[
                  { feature: 'Account Required', openrouter: 'Yes', oma: 'No', highlight: true },
                  { feature: 'KYC Verification', openrouter: 'Yes', oma: 'No', highlight: true },
                  { feature: 'Crypto Payments', openrouter: 'Limited', oma: '100+ Tokens', highlight: true },
                  { feature: 'Data Retention', openrouter: 'Full Logging', oma: 'Minimal', highlight: true },
                  { feature: 'Dashboard', openrouter: 'Yes', oma: 'Yes', highlight: false },
                ].map((row, i) => (
                  <tr key={i} className={`${row.highlight ? 'bg-[var(--color-accent)]/5' : ''} transition-colors hover:bg-[var(--color-surface)]`}>
                    <td className="p-4 font-mono text-sm text-[var(--color-text)]">{row.feature}</td>
                    <td className="p-4 text-center font-mono text-sm text-[var(--color-text-muted)]">{row.openrouter}</td>
                    <td className="p-4 text-center font-mono text-sm font-semibold text-[var(--color-accent)]">{row.oma}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.7, ease: 'easeOut' }}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-8 text-center"
        >
          <h2 className="mb-3 font-syne text-2xl font-bold tracking-tight text-[var(--color-text-bright)]">Ready to Switch?</h2>
          <p className="mb-6 text-sm text-[var(--color-text)]">
            Get started in seconds. Connect your wallet, deposit credits, and start building.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/dashboard" className="btn-primary group">
              Get API Key
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/docs" className="btn-secondary">
              Read Docs
            </Link>
          </div>
        </motion.div>

        <div className="mt-12 flex flex-wrap justify-center gap-4 font-mono text-xs text-[var(--color-text-muted)]">
          <Link href="/compare/venice-ai-alternative" className="hover:text-[var(--color-accent)] transition-colors">Venice AI Alternative</Link>
          <span className="text-[var(--color-border)]">{'//'}</span>
          <Link href="/private-ai-api" className="hover:text-[var(--color-accent)] transition-colors">Private AI API</Link>
          <span className="text-[var(--color-border)]">{'//'}</span>
          <Link href="/crypto-payments" className="hover:text-[var(--color-accent)] transition-colors">Crypto Payments</Link>
          <span className="text-[var(--color-border)]">{'//'}</span>
          <Link href="/pricing" className="hover:text-[var(--color-accent)] transition-colors">Pricing</Link>
        </div>
      </div>
    </div>
  )
}