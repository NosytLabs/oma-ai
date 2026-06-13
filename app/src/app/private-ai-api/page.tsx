import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Shield, EyeOff, Lock, Server, ArrowRight, CheckCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Private AI API - Minimal Data Retention AI Inference',
  description: 'OMA routes inference through Venice AI, which keeps minimal logs. No account required.',
  keywords: ['private AI API', 'zero retention AI', 'privacy AI inference', 'low retention AI API', 'privacy-first AI'],
  openGraph: {
    title: 'Private AI API - Minimal Data Retention AI Inference | OMA AI',
    description: 'Privacy-first AI inference with minimal data retention. No account required.',
    type: 'website',
  },
}

const PRIVACY_FEATURES = [
  {
    icon: EyeOff,
    title: 'Minimal Data Logging',
    desc: 'We log only what\'s essential. No persistent storage of prompts or responses.',
  },
  {
    icon: Lock,
    title: 'No Account Required',
    desc: 'Connect your wallet and start. No email, no phone, no KYC.',
  },
  {
    icon: Server,
    title: 'Venice Backend',
    desc: 'Powered by Venice AI, which shares our commitment to privacy.',
  },
  {
    icon: Shield,
    title: 'Wallet to API',
    desc: 'Connect a wallet, generate a key, hit the endpoint. No email, no phone, no KYC.',
  },
]

export default function PrivateAIAPIPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--color-void)] px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-xs font-mono transition-colors hover:text-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] rounded"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Home
        </Link>

        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-2 text-sm font-mono font-medium text-[var(--color-accent)]">
            <Shield className="h-4 w-4" aria-hidden="true" />
            Privacy-First
          </div>
          <h1 className="font-syne mb-4 text-4xl font-bold tracking-tight text-[var(--color-text)] md:text-5xl">
            Private AI API —
            <span className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-tertiary)] bg-clip-text text-transparent">
              Low-Retention AI Inference Gateway
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-[var(--color-text-muted)]">
            No personal data needed. OMA gives you AI access with minimal logging and zero account requirements.
          </p>
        </div>

        <div className="mb-16 grid gap-6 md:grid-cols-2">
          {PRIVACY_FEATURES.map((feature, index) => (
            <div key={index} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-all hover:border-[var(--color-accent)]/30">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-accent)]/10">
                <feature.icon className="h-6 w-6 text-[var(--color-accent)]" aria-hidden="true" />
              </div>
              <h3 className="mb-2 font-syne text-lg font-bold text-[var(--color-text)]">{feature.title}</h3>
              <p className="text-sm text-[var(--color-text-muted)]">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="mb-16">
          <h2 className="mb-8 font-syne text-2xl font-bold text-[var(--color-text)] text-center">Privacy Comparison</h2>
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-accent)]/5">
                  <th scope="col" className="p-4 text-left font-mono text-sm font-medium text-[var(--color-text)]">Feature</th>
                  <th scope="col" className="p-4 text-center font-mono text-sm font-medium text-[var(--color-text-muted)]">Traditional AI APIs</th>
                  <th scope="col" className="p-4 text-center font-mono text-sm font-medium text-[var(--color-accent)]">OMA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                <tr className="transition-colors hover:bg-[var(--color-surface)]/50">
                  <td className="p-4 text-sm text-[var(--color-text-muted)]">Account Required</td>
                  <td className="p-4 text-center text-sm text-[var(--color-text-muted)]">Yes</td>
                  <td className="p-4 text-center font-mono text-sm font-bold text-[var(--color-accent)]">No</td>
                </tr>
                <tr className="transition-colors hover:bg-[var(--color-surface)]/50">
                  <td className="p-4 text-sm text-[var(--color-text-muted)]">Email Verification</td>
                  <td className="p-4 text-center text-sm text-[var(--color-text-muted)]">Yes</td>
                  <td className="p-4 text-center font-mono text-sm font-bold text-[var(--color-accent)]">No</td>
                </tr>
                <tr className="transition-colors hover:bg-[var(--color-surface)]/50">
                  <td className="p-4 text-sm text-[var(--color-text-muted)]">Phone Number</td>
                  <td className="p-4 text-center text-sm text-[var(--color-text-muted)]">Sometimes</td>
                  <td className="p-4 text-center font-mono text-sm font-bold text-[var(--color-accent)]">No</td>
                </tr>
                <tr className="transition-colors hover:bg-[var(--color-surface)]/50">
                  <td className="p-4 text-sm text-[var(--color-text-muted)]">KYC Verification</td>
                  <td className="p-4 text-center text-sm text-[var(--color-text-muted)]">Often</td>
                  <td className="p-4 text-center font-mono text-sm font-bold text-[var(--color-accent)]">Never</td>
                </tr>
                <tr className="transition-colors hover:bg-[var(--color-surface)]/50">
                  <td className="p-4 text-sm text-[var(--color-text-muted)]">Persistent Logging</td>
                  <td className="p-4 text-center text-sm text-[var(--color-text-muted)]">Full logs</td>
                  <td className="p-4 text-center font-mono text-sm font-bold text-[var(--color-accent)]">Minimal</td>
                </tr>
                <tr className="transition-colors hover:bg-[var(--color-surface)]/50">
                  <td className="p-4 text-sm text-[var(--color-text-muted)]">Data Sold to Third Parties</td>
                  <td className="p-4 text-center text-sm text-[var(--color-text-muted)]">Possible</td>
                  <td className="p-4 text-center font-mono text-sm font-bold text-[var(--color-accent)]">Never</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-8 font-syne text-2xl font-bold text-[var(--color-text)] text-center">What We Log</h2>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)' }}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10">
                  <span className="font-mono text-sm font-bold text-[var(--color-accent)]">1</span>
                </div>
                <div>
                  <h3 className="mb-1 font-mono text-sm font-semibold text-[var(--color-text)]">Transaction Hashes</h3>
                  <p className="text-sm text-[var(--color-text-muted)]">Blockchain hashes for credit deposits. Lets us handle refund disputes.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)' }}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10">
                  <span className="font-mono text-sm font-bold text-[var(--color-accent)]">2</span>
                </div>
                <div>
                  <h3 className="mb-1 font-mono text-sm font-semibold text-[var(--color-text)]">Credit Balances</h3>
                  <p className="text-sm text-[var(--color-text-muted)]">We track your credit balance so you can pay per request.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)' }}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10">
                  <span className="font-mono text-sm font-bold text-[var(--color-accent)]">3</span>
                </div>
                <div>
                  <h3 className="mb-1 font-mono text-sm font-semibold text-[var(--color-text)]">API Request Metadata</h3>
                  <p className="text-sm text-[var(--color-text-muted)]">Timestamps and model IDs only. No prompt or response content.</p>
                </div>
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-[var(--color-accent)]/20 p-4" style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 5%, transparent)' }}>
              <p className="text-sm text-[var(--color-text-muted)]">
                <span className="font-mono font-semibold text-[var(--color-accent)]">What we don&apos;t log:</span> Your prompts and responses stay private. AI generation runs entirely on Venice&apos;s infrastructure.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-8 font-syne text-2xl font-bold text-[var(--color-text)] text-center">Built on Venice</h2>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <p className="mb-4 text-sm text-[var(--color-text-muted)]">
              OMA routes inference to Venice AI, which operates under their own privacy policy. Venice offers:
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)' }}>
                <CheckCircle className="h-5 w-5 shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
                <span className="text-sm text-[var(--color-text)]">Minimal prompt and response retention</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)' }}>
                <CheckCircle className="h-5 w-5 shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
                <span className="text-sm text-[var(--color-text)]">No training on user data</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)' }}>
                <CheckCircle className="h-5 w-5 shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
                <span className="text-sm text-[var(--color-text)]">Privacy-focused infrastructure</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)' }}>
                <CheckCircle className="h-5 w-5 shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
                <span className="text-sm text-[var(--color-text)]">Audited on-chain settlement</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <h2 className="font-syne mb-4 text-2xl font-bold text-[var(--color-text)]">Start Now</h2>
          <p className="mb-6 text-[var(--color-text-muted)]">
            No account needed. Connect your wallet, add credits, and start inferring.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-6 py-3 font-mono text-sm font-semibold text-[var(--color-text-inverse)] shadow-lg shadow-[var(--color-accent)]/20 transition-all hover:bg-[var(--color-accent-hover)] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2">
              Get API Key
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/docs" className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-transparent px-6 py-3 font-mono text-sm font-medium text-[var(--color-text)] transition-all hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2">
              View Documentation
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
