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
    <div className="min-h-[calc(100vh-4rem)] bg-void px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-xs font-mono transition-colors hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent rounded"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Home
        </Link>

        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-mono font-medium text-accent">
            <Shield className="h-4 w-4" aria-hidden="true" />
            Privacy-First
          </div>
          <h1 className="h1-page mb-4 text-text">
            Private AI API —
            <span className="bg-gradient-to-r from-accent to-tertiary bg-clip-text text-transparent">
              inference without your data on file
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-text-muted">
            Prompts and completions stay on Venice&apos;s privacy-focused infrastructure. OMA only records what billing needs: tx hashes, your credit balance, and per-request token counts. Wallet to API, no email, no KYC.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/dashboard/api-keys"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 font-mono text-sm font-semibold text-text-inverse shadow-lg shadow-accent/20 transition-all hover:bg-accent-hover hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            >
              Get a private key
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-transparent px-6 py-3 font-mono text-sm font-medium text-text transition-all hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            >
              Read the privacy docs
            </Link>
          </div>
        </div>

        <div className="mb-16 grid gap-6 md:grid-cols-2">
          {PRIVACY_FEATURES.map((feature, index) => (
            <div key={index} className="rounded-xl border border-border bg-surface p-6 transition-all hover:border-accent/30">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                <feature.icon className="h-6 w-6 text-accent" aria-hidden="true" />
              </div>
              <h3 className="mb-2 font-display text-lg font-bold text-text">{feature.title}</h3>
              <p className="text-sm text-text-muted">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="mb-16">
          <h2 className="mb-8 font-display text-2xl font-bold text-text text-center">Privacy Comparison</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-accent/5">
                  <th scope="col" className="p-4 text-left font-mono text-sm font-medium text-text">Feature</th>
                  <th scope="col" className="p-4 text-center font-mono text-sm font-medium text-text-muted">Traditional AI APIs</th>
                  <th scope="col" className="p-4 text-center font-mono text-sm font-medium text-accent">OMA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="transition-colors hover:bg-surface/50">
                  <td className="p-4 text-sm text-text-muted">Account Required</td>
                  <td className="p-4 text-center text-sm text-text-muted">Yes</td>
                  <td className="p-4 text-center font-mono text-sm font-bold text-accent">No</td>
                </tr>
                <tr className="transition-colors hover:bg-surface/50">
                  <td className="p-4 text-sm text-text-muted">Email Verification</td>
                  <td className="p-4 text-center text-sm text-text-muted">Yes</td>
                  <td className="p-4 text-center font-mono text-sm font-bold text-accent">No</td>
                </tr>
                <tr className="transition-colors hover:bg-surface/50">
                  <td className="p-4 text-sm text-text-muted">Phone Number</td>
                  <td className="p-4 text-center text-sm text-text-muted">Sometimes</td>
                  <td className="p-4 text-center font-mono text-sm font-bold text-accent">No</td>
                </tr>
                <tr className="transition-colors hover:bg-surface/50">
                  <td className="p-4 text-sm text-text-muted">KYC Verification</td>
                  <td className="p-4 text-center text-sm text-text-muted">Often</td>
                  <td className="p-4 text-center font-mono text-sm font-bold text-accent">Never</td>
                </tr>
                <tr className="transition-colors hover:bg-surface/50">
                  <td className="p-4 text-sm text-text-muted">Persistent Logging</td>
                  <td className="p-4 text-center text-sm text-text-muted">Full logs</td>
                  <td className="p-4 text-center font-mono text-sm font-bold text-accent">Minimal</td>
                </tr>
                <tr className="transition-colors hover:bg-surface/50">
                  <td className="p-4 text-sm text-text-muted">Data Sold to Third Parties</td>
                  <td className="p-4 text-center text-sm text-text-muted">Possible</td>
                  <td className="p-4 text-center font-mono text-sm font-bold text-accent">Never</td>
                </tr>
              </tbody>
            </table></div>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-8 font-display text-2xl font-bold text-text text-center">What We Log</h2>
          <div className="rounded-xl border border-border bg-surface p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)' }}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <span className="font-mono text-sm font-bold text-accent">1</span>
                </div>
                <div>
                  <h3 className="mb-1 font-mono text-sm font-semibold text-text">Transaction Hashes</h3>
                  <p className="text-sm text-text-muted">Blockchain hashes for credit deposits. Lets us handle refund disputes.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)' }}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <span className="font-mono text-sm font-bold text-accent">2</span>
                </div>
                <div>
                  <h3 className="mb-1 font-mono text-sm font-semibold text-text">Credit Balances</h3>
                  <p className="text-sm text-text-muted">We track your credit balance so you can pay per request.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)' }}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <span className="font-mono text-sm font-bold text-accent">3</span>
                </div>
                <div>
                  <h3 className="mb-1 font-mono text-sm font-semibold text-text">API Request Metadata</h3>
                  <p className="text-sm text-text-muted">Timestamps and model IDs only. No prompt or response content.</p>
                </div>
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-accent/20 p-4" style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 5%, transparent)' }}>
              <p className="text-sm text-text-muted">
                <span className="font-mono font-semibold text-accent">What we don&apos;t log:</span> Your prompts and responses stay private. AI generation runs entirely on Venice&apos;s infrastructure.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-8 font-display text-2xl font-bold text-text text-center">Built on Venice</h2>
          <div className="rounded-xl border border-border bg-surface p-6">
            <p className="mb-4 text-sm text-text-muted">
              OMA routes inference to Venice AI, which operates under their own privacy policy. Venice offers:
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)' }}>
                <CheckCircle className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                <span className="text-sm text-text">Minimal prompt and response retention</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)' }}>
                <CheckCircle className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                <span className="text-sm text-text">No training on user data</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)' }}>
                <CheckCircle className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                <span className="text-sm text-text">Privacy-focused infrastructure</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)' }}>
                <CheckCircle className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                <span className="text-sm text-text">Verifiable on-chain settlement</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <h2 className="font-display mb-4 text-2xl font-bold text-text">Start Now</h2>
          <p className="mb-6 text-text-muted">
            No account needed. Connect a wallet, generate a private API key, and start inferring.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/dashboard/api-keys"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 font-mono text-sm font-semibold text-text-inverse shadow-lg shadow-accent/20 transition-all hover:bg-accent-hover hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            >
              Get a private key
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-transparent px-6 py-3 font-mono text-sm font-medium text-text transition-all hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            >
              View dashboard
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-transparent px-6 py-3 font-mono text-sm font-medium text-text transition-all hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
