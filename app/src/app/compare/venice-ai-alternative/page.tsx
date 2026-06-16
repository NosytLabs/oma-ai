'use client'

import Link from 'next/link'
import { ArrowLeft, Layers, LayoutDashboard, RefreshCw, ArrowRight, CheckCircle, CreditCard } from 'lucide-react'
import { motion } from 'framer-motion'

export default function VeniceAIAlternativePage() {
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
          transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
          className="mb-16"
        >
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5">
              <Layers className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-mono font-semibold text-accent">Gateway Layer</span>
            </div>
          </div>

          <h1 className="h1-page mb-6" style={{ color: 'var(--color-text-bright)' }}>
            Venice AI Alternative —
            <span className="gradient-text">Gateway Layer for Easy Access</span>
          </h1>

          <p className="max-w-2xl text-base leading-relaxed text-text">
            OMA sits on top of Venice AI, adding intelligent routing, credit management, and a developer-friendly dashboard while maintaining Venice&apos;s powerful inference capabilities.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
          className="mb-16"
        >
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
              <span className="font-mono text-xs text-text-muted">{'//'} enhancements</span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: CreditCard, label: '01', title: 'Credits System', desc: 'Pre-purchase credits with crypto and pay per token. No need to manage multiple transactions or worry about per-request crypto fees.' },
              { icon: LayoutDashboard, label: '02', title: 'Dashboard Analytics', desc: 'Track usage, monitor costs, and analyze model performance through an intuitive dashboard built for developers.' },
              { icon: RefreshCw, label: '03', title: 'Smart Routing', desc: 'Intelligent request routing with automatic failover ensures your applications stay running even if a backend experiences issues.' },
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
              <h2 className="font-display text-2xl font-bold tracking-tight text-text-bright">What OMA Adds to Venice</h2>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { title: 'Credit System', desc: 'Pre-purchase tokens and pay as you go without per-request blockchain overhead' },
              { title: 'Unified Dashboard', desc: 'Monitor usage, costs, and model performance in one place' },
              { title: 'Smart Routing', desc: 'Automatic failover and load balancing across Venice infrastructure' },
              { title: 'Competitive Pricing', desc: 'Transparent per-token pricing with no hidden fees or surprise charges' },
              { title: 'Developer Tools', desc: 'OpenAI-compatible API, making migration from other providers straightforward' },
              { title: '100+ Crypto Tokens', desc: 'Pay with any of 100+ supported cryptocurrencies via Houdini Swap' },
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
          transition={{ duration: 0.4, delay: 0.5, ease: 'easeOut' }}
          className="mb-16"
        >
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
              <h2 className="font-display text-2xl font-bold tracking-tight text-text-bright">Still Powered by Venice</h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              { title: 'High-Quality Models', desc: 'Access to Claude Opus 4.7, GPT-4o, Gemini 3.1 Pro, and other leading models through Venice' },
              { title: 'Reliable Infrastructure', desc: 'Venice\'s established data centers and redundancy ensure consistent uptime' },
              { title: 'Privacy-Focused', desc: 'Venice\'s commitment to minimal data logging complements OMA\'s approach' },
              { title: 'Competitive Pricing', desc: 'OMA passes through Venice\'s competitive model pricing with our credit markup' },
            ].map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.6 + i * 0.1, ease: 'easeOut' }}
                className="rounded-xl border border-border bg-surface p-5"
              >
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <h3 className="font-display text-sm font-semibold text-text-bright">{card.title}</h3>
                </div>
                <p className="text-sm text-text-muted">{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.7, ease: 'easeOut' }}
          className="rounded-xl border border-border bg-panel p-8 text-center"
        >
          <h2 className="mb-3 font-display text-2xl font-bold tracking-tight text-text-bright">Start Using OMA Today</h2>
          <p className="mb-6 text-sm text-text">
            Get the Venice experience with added convenience. No account needed—just connect your wallet.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/dashboard" className="btn-primary group">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/docs" className="btn-secondary">
              Read Docs
            </Link>
          </div>
        </motion.div>

        <div className="mt-12 flex flex-wrap justify-center gap-4 font-mono text-xs text-text-muted">
          <Link href="/compare/openrouter-alternative" className="hover:text-accent transition-colors">OpenRouter Alternative</Link>
          <span className="text-border">{'//'}</span>
          <Link href="/crypto-payments" className="hover:text-accent transition-colors">Crypto Payments</Link>
          <span className="text-border">{'//'}</span>
          <Link href="/private-ai-api" className="hover:text-accent transition-colors">Private AI API</Link>
          <span className="text-border">{'//'}</span>
          <Link href="/pricing" className="hover:text-accent transition-colors">Pricing</Link>
        </div>
      </div>
    </div>
  )
}