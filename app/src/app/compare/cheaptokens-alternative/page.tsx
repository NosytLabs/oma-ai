'use client'
import Link from 'next/link'
import { ArrowLeft, Coins, ArrowRight, CheckCircle, TrendingDown, Wallet } from 'lucide-react'
import { motion } from 'framer-motion'

export default function CheapTokensAlternativePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-xs font-mono text-text-muted transition-colors hover:text-accent">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Home
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mb-16"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mb-6"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5">
              <Coins className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-mono font-semibold text-accent">Cost-Effective AI</span>
            </div>
          </motion.div>

          <h1 className="h1-page mb-6" style={{ color: 'var(--color-text-bright)' }}>
            CheapTokens Alternative for
            <span className="gradient-text">Affordable AI Inference</span>
          </h1>

          <p className="max-w-2xl text-base leading-relaxed" style={{ color: 'var(--color-text)' }}>
            Get competitive AI inference pricing without the friction. OMA delivers transparent pricing, crypto-native payments, and a credit system that works for developers.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
          className="mb-16"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            <span className="font-mono text-xs text-text-muted">{'//'} advantages</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: TrendingDown, label: '01', title: 'Competitive Rates', desc: 'OMA passes through Venice\'s competitive model pricing with a transparent credit system. No hidden fees or surprise charges.' },
              { icon: Wallet, label: '02', title: 'Crypto-Native Payments', desc: 'Pay with 100+ cryptocurrencies. No credit cards needed. Wallet-to-wallet simplicity with no financial surveillance.' },
              { icon: Coins, label: '03', title: 'Credit System', desc: 'Pre-purchase credits with crypto and pay as you go. No per-request blockchain overhead and full transparency on usage.' },
            ].map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
                className="group relative overflow-hidden rounded-xl border border-border bg-panel p-6 transition-all hover:border-accent/30"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="font-mono text-xs text-text-muted">{card.label}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface">
                    <card.icon className="h-5 w-5 text-accent" />
                  </div>
                  <h3 className="mb-2 font-display text-base font-semibold text-text-bright">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-text-muted">{card.desc}</p>
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
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
              <h2 className="font-display text-2xl font-bold tracking-tight text-text-bright">Why OMA Beats CheapTokens</h2>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { title: 'No Account Required', desc: 'Connect your wallet and start inferring in seconds. No email, no waiting period. Low-friction access for builders.' },
              { title: '100+ Crypto Tokens', desc: 'Pay with any supported cryptocurrency via Houdini Swap integration.' },
              { title: 'Credit System', desc: 'Pre-purchase credits and pay as you go without per-request blockchain overhead.' },
              { title: 'Multi-Provider Routing', desc: 'Access models across Venice, OpenRouter, Together, and more through a single API.' },
              { title: 'OpenAI-Compatible API', desc: 'Easy migration from CheapTokens or other providers with our OpenAI-compatible endpoint.' },
              { title: 'Dashboard Analytics', desc: 'Track usage, monitor costs, and analyze model performance in real-time.' },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.5 + index * 0.05, ease: 'easeOut' }}
                className="group flex items-start gap-4 rounded-lg border border-border bg-panel p-4 transition-all hover:border-accent/30"
              >
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-accent/30 bg-accent/10">
                  <CheckCircle className="h-3 w-3 text-accent" />
                </div>
                <div>
                  <span className="font-display text-sm font-semibold text-text-bright">{item.title}: </span>
                  <span className="text-sm text-text">{item.desc}</span>
                </div>
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
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
              <h2 className="font-display text-2xl font-bold tracking-tight text-text-bright">Compare: OMA vs CheapTokens</h2>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-panel">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-4 text-left font-mono text-xs font-semibold uppercase tracking-wider text-text-muted">Feature</th>
                  <th className="p-4 text-center font-mono text-xs font-semibold uppercase tracking-wider text-text-muted">CheapTokens</th>
                  <th className="p-4 text-center font-mono text-xs font-semibold uppercase tracking-wider text-accent">OMA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { feature: 'Account Required', cheap: 'Yes', oma: 'No', highlight: true },
                  { feature: 'Crypto Payments', cheap: 'Limited', oma: '100+ Tokens', highlight: true },
                  { feature: 'Multi-Provider', cheap: 'No', oma: 'Yes', highlight: true },
                  { feature: 'Credit System', cheap: 'No', oma: 'Yes', highlight: true },
                  { feature: 'Dashboard', cheap: 'Limited', oma: 'Full Analytics', highlight: false },
                ].map((row, i) => (
                  <tr key={i} className={`${row.highlight ? 'bg-accent/5' : ''} transition-colors hover:bg-surface`}>
                    <td className="p-4 font-mono text-sm text-text">{row.feature}</td>
                    <td className="p-4 text-center font-mono text-sm text-text-muted">{row.cheap}</td>
                    <td className="p-4 text-center font-mono text-sm font-semibold text-accent">{row.oma}</td>
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
          className="rounded-xl border border-border bg-panel p-8 text-center"
        >
          <h2 className="mb-3 font-display text-2xl font-bold tracking-tight text-text-bright">Start Saving on AI Inference</h2>
          <p className="mb-6 text-sm text-text">
            Get competitive pricing with the convenience of crypto payments and no account required.
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

        <div className="mt-12 flex flex-wrap justify-center gap-4 font-mono text-xs text-text-muted">
          <span className="text-border">{'//'}</span>
          <Link href="/pricing" className="hover:text-accent transition-colors">Pricing</Link>
          <span className="text-border">{'//'}</span>
          <Link href="/private-ai-api" className="hover:text-accent transition-colors">Private AI API</Link>
        </div>
      </div>
    </div>
  )
}