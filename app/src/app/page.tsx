import type { Metadata } from 'next'
import Link from 'next/link'
import { Route, Globe, Server, Boxes, GitBranch } from 'lucide-react'
import { MODELS as CENTRALIZED_MODELS } from '@/lib/models-data'

export const metadata: Metadata = {
  title: 'OMA AI - One Man Army // Open Model Access',
  description: 'Permissionless AI inference gateway. Access 50+ models with crypto payments. No sign-up required. Route inference across multiple providers.',
  openGraph: {
    title: 'OMA AI - One Man Army // Open Model Access',
    description: 'Permissionless AI inference gateway. Access 50+ models with crypto payments. No sign-up required.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  other: {
    'product:price:amount': '0',
    'product:price:currency': 'USD',
  },
}

// Transform centralized models data to match the format expected by the UI
const MODELS = [
  // Models from centralized data (Venice and AntSeed)
  ...CENTRALIZED_MODELS
    .filter(model => 
      ['deepseek-v3', 'llama-3.3-70b', 'qwen3-480b', 'gemma-3-27b', 'llama-3.2-3b', 'deepseek-r1'].includes(model.id)
    )
    .map(model => ({
      id: model.id,
      provider: model.provider === 'Venice' && model.id === 'llama-3.3-70b' ? 'Venice/AntSeed' : 
               model.provider === 'AntSeed' && model.id === 'qwen3-480b' ? 'AntSeed' :
               model.provider,
      ctx: model.contextLength.toLowerCase(),
      tier: model.tier
    })),
  // Hardcoded models for other providers not yet in centralized data
  { id: 'gpt-4o-mini', provider: 'OpenRouter', ctx: '128k', tier: 'mid' },
  { id: 'mistral-7b', provider: 'Together', ctx: '8k', tier: 'budget' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--color-void)] text-[var(--color-text-secondary)] font-mono selection:bg-[var(--color-accent-dim)] selection:text-[var(--color-accent)]">
      <div className="overflow-x-clip">
        <main className="flex flex-col">
          
          <section id="init" aria-label="Introduction" className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8 md:pb-20 md:pt-20 animate-slide-up">
            <p className="text-xs text-[var(--color-text-secondary)] mb-6 tracking-wider font-mono">
              {'>'} OMA AI GATEWAY — 50+ models across 6 providers. Pay with crypto.
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-[var(--color-text-bright)] font-bold mb-6 tracking-tight leading-[1.1] font-syne" style={{ overflowWrap: 'anywhere', minWidth: 0 }}>
              Route inference{' '}<br className="hidden sm:block" />
              across 50+ models.<br />
              <span className="text-[var(--color-accent)]">One Man Army.</span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed mb-10 text-[var(--color-text)]">
              Route through Venice, AntSeed, OpenRouter, Together, DeepInfra, and
              local providers with one API key. Automatic failover and circuit
              breakers keep you running. No lock-in.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <Link href="/docs" className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-sm font-bold hover:bg-[var(--color-accent-hover)] hover:shadow-lg hover:shadow-[var(--color-accent)]/20 active:scale-95 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2">
                Read the docs
              </Link>
              <Link href="/playground" className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-[var(--color-border-bright)] text-[var(--color-text-bright)] text-sm font-medium hover:bg-[var(--color-surface)] hover:border-[var(--color-accent)]/50 active:scale-95 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[var(--color-text-bright)] focus-visible:outline-offset-2">
                Try the playground
              </Link>
            </div>
          </section>

          <section id="status" aria-label="Provider status" className="mx-auto w-full max-w-5xl px-4 pb-12 md:pb-20 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <h2 className="text-xs text-[var(--color-text-secondary)] uppercase tracking-widest mb-6 border-b border-[var(--color-border)] pb-3">
              {'>'} live_routing
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="group border border-[var(--color-border)] bg-[var(--color-surface)] p-6 flex flex-col gap-3 hover:border-[var(--color-accent)]/40 hover:shadow-lg hover:shadow-[var(--color-accent)]/5 transition-all duration-300 cursor-default">
                <div className="w-10 h-10 rounded border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 flex items-center justify-center mb-2">
                  <Route className="w-5 h-5 text-[var(--color-accent)]" />
                </div>
                <span className="text-[10px] tracking-widest text-[var(--color-text-secondary)] uppercase font-medium">Primary</span>
                <span className="text-lg text-[var(--color-text-bright)] font-semibold">Venice AI</span>
                <span className="text-sm leading-relaxed text-[var(--color-text-secondary)]">Chat completions, images, video, embeddings</span>
                <div className="flex items-center gap-2 mt-auto">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--color-accent)]"></span>
                  </span>
                  <span className="text-sm text-[var(--color-accent)] font-medium">online (12ms)</span>
                </div>
              </div>
              <div className="group border border-[var(--color-border)] bg-[var(--color-surface)] p-6 flex flex-col gap-3 hover:border-[var(--color-accent)]/40 hover:shadow-lg hover:shadow-[var(--color-accent)]/5 transition-all duration-300 cursor-default">
                <div className="w-10 h-10 rounded border border-[var(--color-secondary)]/20 bg-[var(--color-secondary)]/10 flex items-center justify-center mb-2">
                  <Globe className="w-5 h-5 text-[var(--color-secondary)]" />
                </div>
                <span className="text-[10px] tracking-widest text-[var(--color-text-secondary)] uppercase font-medium">Failover</span>
                <span className="text-lg text-[var(--color-text-bright)] font-semibold">AntSeed</span>
                <span className="text-sm leading-relaxed text-[var(--color-text-secondary)]">Warm standby, automatic failover</span>
                <div className="flex items-center gap-2 mt-auto">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-secondary)] opacity-50"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--color-secondary)]"></span>
                  </span>
                  <span className="text-sm text-[var(--color-secondary)] font-medium">standby (45ms)</span>
                </div>
              </div>
              <div className="group border border-[var(--color-border)] bg-[var(--color-surface)] p-6 flex flex-col gap-3 hover:border-[var(--color-accent)]/40 hover:shadow-lg hover:shadow-[var(--color-accent)]/5 transition-all duration-300 cursor-default">
                <div className="w-10 h-10 rounded border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 flex items-center justify-center mb-2">
                  <Route className="w-5 h-5 text-[var(--color-accent)]" />
                </div>
                <span className="text-[10px] tracking-widest text-[var(--color-text-secondary)] uppercase font-medium">Search</span>
                <span className="text-lg text-[var(--color-text-bright)] font-semibold">TinyFish</span>
                <span className="text-sm leading-relaxed text-[var(--color-text-secondary)]">Web search for real-time answers</span>
                <div className="flex items-center gap-2 mt-auto">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--color-accent)]"></span>
                  </span>
                  <span className="text-sm text-[var(--color-accent)] font-medium">online (201ms)</span>
                </div>
              </div>
            </div>
          </section>

          <section id="models" aria-label="Supported models" className="mx-auto w-full max-w-5xl px-4 pb-12 md:pb-20 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <h2 className="text-xs text-[var(--color-text-secondary)] uppercase tracking-widest mb-6 border-b border-[var(--color-border)] pb-3">
              {'>'} supported_models
            </h2>
            <div className="overflow-x-auto w-full border border-[var(--color-border)] rounded-lg">
              <table className="w-full text-sm text-left">
                <caption className="sr-only">Supported AI models with their providers, tiers, and context lengths</caption>
                <thead>
                  <tr className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                    <th className="py-4 px-5 font-medium">Model</th>
                    <th className="py-4 px-5 font-medium hidden sm:table-cell">Provider</th>
                    <th className="py-4 px-5 font-medium hidden md:table-cell">Tier</th>
                    <th className="py-4 px-5 font-medium text-right">Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {MODELS.map((model) => (
                    <tr key={model.id} className="hover:bg-[var(--color-surface-elevated)] transition-colors duration-200 group">
                      <td className="py-4 px-5 text-[var(--color-text-bright)] text-sm font-semibold group-hover:text-[var(--color-accent)] transition-colors">{model.id}</td>
                      <td className="py-4 px-5 text-sm hidden sm:table-cell">{model.provider}</td>
                      <td className="py-4 px-5 text-sm hidden md:table-cell">
                        <span className={
                          model.tier === 'premium' ? 'text-[var(--color-accent)]' :
                          model.tier === 'mid' ? 'text-[var(--color-secondary)]' :
                          'text-[var(--color-text-secondary)]'
                        }>{model.tier}</span>
                      </td>
                      <td className="py-4 px-5 text-sm text-right text-[var(--color-text-secondary)]">{model.ctx}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mt-4 text-center">40+ more models across 6 providers</p>
          </section>

          <section id="stats" aria-label="Statistics" className="mx-auto w-full max-w-5xl px-4 pb-12 md:pb-20 animate-slide-up" style={{ animationDelay: '300ms' }}>
            <h2 className="text-xs text-[var(--color-text-secondary)] uppercase tracking-widest mb-6 border-b border-[var(--color-border)] pb-3">
              {'>'} why_oma
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="col-span-2 lg:col-span-1 group border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center hover:border-[var(--color-accent)]/40 hover:shadow-lg hover:shadow-[var(--color-accent)]/5 transition-all duration-300">
                <div className="w-12 h-12 rounded border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-3">
                  <Boxes className="w-6 h-6 text-[var(--color-accent)]" />
                </div>
                <span className="text-4xl text-[var(--color-text-bright)] font-bold block mb-2 group-hover:text-[var(--color-accent)] transition-colors">6</span>
                <span className="text-sm text-[var(--color-text-secondary)]">model providers</span>
              </div>
              <div className="col-span-2 lg:col-span-1 group border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center hover:border-[var(--color-accent)]/40 hover:shadow-lg hover:shadow-[var(--color-accent)]/5 transition-all duration-300">
                <div className="w-12 h-12 rounded border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-3">
                  <Server className="w-6 h-6 text-[var(--color-accent)]" />
                </div>
                <span className="text-4xl text-[var(--color-text-bright)] font-bold block mb-2 group-hover:text-[var(--color-accent)] transition-colors">50+</span>
                <span className="text-sm text-[var(--color-text-secondary)]">models available</span>
              </div>
              <div className="col-span-2 lg:col-span-1 group border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center hover:border-[var(--color-accent)]/40 hover:shadow-lg hover:shadow-[var(--color-accent)]/5 transition-all duration-300">
                <div className="w-12 h-12 rounded border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-3">
                   <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-[var(--color-accent)]">
                     <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                     <path d="M12 8v4l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                   </svg>
                </div>
                <span className="text-4xl text-[var(--color-text-bright)] font-bold block mb-2 group-hover:text-[var(--color-accent)] transition-colors">100+</span>
                <span className="text-sm text-[var(--color-text-secondary)]">cryptocurrencies</span>
              </div>
              <div className="col-span-2 lg:col-span-1 group border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center hover:border-[var(--color-accent)]/40 hover:shadow-lg hover:shadow-[var(--color-accent)]/5 transition-all duration-300">
                <div className="w-12 h-12 rounded border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-3">
                  <GitBranch className="w-6 h-6 text-[var(--color-accent)]" />
                </div>
                <span className="text-4xl text-[var(--color-text-bright)] font-bold block mb-2 group-hover:text-[var(--color-accent)] transition-colors">&lt;50ms</span>
                <span className="text-sm text-[var(--color-text-secondary)]">avg failover time</span>
              </div>
            </div>
          </section>

          <section id="auth" className="mx-auto w-full max-w-5xl px-4 pb-12 md:pb-20 animate-slide-up" style={{ animationDelay: '400ms' }}>
            <h2 className="text-xs text-[var(--color-text-secondary)] uppercase tracking-widest mb-6 border-b border-[var(--color-border)] pb-3">
              {'>'} authentication
            </h2>
            <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6 rounded-lg font-mono text-sm overflow-x-auto">
              <code className="block whitespace-pre-wrap break-all text-[var(--color-text-secondary)] leading-relaxed">
                <span className="block"><span className="text-[var(--color-text-bright)] font-semibold">POST</span> /v1/chat/completions</span>
                <span className="block mt-3"><span className="text-[var(--color-accent)]">Authorization</span>: Bearer x402_...</span>
                <span className="block mt-4 text-[var(--color-text-secondary)]">{`{
  "model": "llama-3.3-70b",
  "messages": [
    {"role": "user", "content": "Explain circuit breaking."}
  ],
  "stream": true
}`}</span>
              </code>
            </div>
          </section>

          <section id="cta" aria-label="Call to action" className="mx-auto w-full max-w-5xl px-4 pb-16 md:pb-24 animate-slide-up" style={{ animationDelay: '500ms' }}>
            <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-8 md:p-12 text-center rounded-xl hover:border-[var(--color-accent)]/30 transition-all duration-300">
              <p className="text-xs text-[var(--color-text-secondary)] mb-4 tracking-wider">{'>'} get_started</p>
              <h2 className="text-2xl md:text-3xl text-[var(--color-text-bright)] font-bold mb-5 leading-tight">
                One API key works across six providers. No lock-in.
              </h2>
              <p className="text-base text-[var(--color-text)] mb-8 max-w-lg mx-auto leading-relaxed">
                Connect your wallet, grab an API key, and you&apos;re routing in under a minute.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/docs" className="inline-flex items-center justify-center px-7 py-3.5 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-sm font-bold hover:bg-[var(--color-accent-hover)] hover:shadow-lg hover:shadow-[var(--color-accent)]/25 active:scale-95 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2">
                  Get started
                </Link>
                <Link href="/dashboard" className="inline-flex items-center justify-center px-7 py-3.5 rounded-full border border-[var(--color-border-bright)] text-[var(--color-text-bright)] text-sm font-medium hover:bg-[var(--color-void)] hover:border-[var(--color-accent)]/50 active:scale-95 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[var(--color-text-bright)] focus-visible:outline-offset-2">
                  View Dashboard
                </Link>
              </div>
            </div>
          </section>

        </main>
      </div>
    </div>
  )
}