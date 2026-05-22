import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Shield, EyeOff, Lock, Server, ArrowRight, CheckCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Private AI API - Low-Retention AI Inference Gateway',
  description: 'Experience truly private AI inference with OMA. Venice-powered backend with minimal data logging, no account required, and privacy-first architecture.',
  keywords: ['private AI API', 'zero retention AI', 'privacy AI inference', 'no log AI API', 'anonymous AI'],
  openGraph: {
    title: 'Private AI API - Low-Retention AI Inference Gateway | OMA AI',
    description: 'Privacy-first AI inference with minimal data retention. No account required.',
    type: 'website',
  },
}

const PRIVACY_FEATURES = [
  {
    icon: EyeOff,
    title: 'Minimal Data Logging',
    desc: 'We log only what\'s essential for service delivery. No persistent storage of prompts or responses.',
  },
  {
    icon: Lock,
    title: 'No Account Required',
    desc: 'Connect your wallet and start inferring immediately. No email, no phone number, no identity verification.',
  },
  {
    icon: Server,
    title: 'Venice Backend',
    desc: 'Powered by Venice AI, which shares our commitment to privacy-respecting inference infrastructure.',
  },
  {
    icon: Shield,
    title: 'Low-Friction Access',
    desc: 'Privacy doesn\'t mean bureaucracy. Get started in seconds without sacrificing your data.',
  },
]

export default function PrivateAIAPIPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700">
            <Shield className="h-4 w-4" />
            Privacy-First
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Private AI API - <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Low-Retention AI Inference Gateway</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            Your AI inference shouldn&apos;t require sharing personal data. OMA delivers powerful AI access with minimal logging and zero account requirements.
          </p>
        </div>

        <div className="mb-16 grid gap-6 md:grid-cols-2">
          {PRIVACY_FEATURES.map((feature, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
                <feature.icon className="h-6 w-6 text-indigo-700" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-slate-900">{feature.title}</h3>
              <p className="text-slate-600">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="mb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">Privacy Comparison</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="p-4 text-left font-semibold text-slate-900">Feature</th>
                  <th className="p-4 text-center font-semibold text-slate-900">Traditional AI APIs</th>
                  <th className="p-4 text-center font-semibold text-indigo-700">OMA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="p-4 text-slate-600">Account Required</td>
                  <td className="p-4 text-center text-slate-600">Yes</td>
                  <td className="p-4 text-center font-semibold text-indigo-700">No</td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="p-4 text-slate-600">Email Verification</td>
                  <td className="p-4 text-center text-slate-600">Yes</td>
                  <td className="p-4 text-center font-semibold text-indigo-700">No</td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-600">Phone Number</td>
                  <td className="p-4 text-center text-slate-600">Sometimes</td>
                  <td className="p-4 text-center font-semibold text-indigo-700">No</td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="p-4 text-slate-600">KYC Verification</td>
                  <td className="p-4 text-center text-slate-600">Often</td>
                  <td className="p-4 text-center font-semibold text-indigo-700">Never</td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-600">Persistent Logging</td>
                  <td className="p-4 text-center text-slate-600">Full logs</td>
                  <td className="p-4 text-center font-semibold text-indigo-700">Minimal</td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="p-4 text-slate-600">Data Sold to Third Parties</td>
                  <td className="p-4 text-center text-slate-600">Possible</td>
                  <td className="p-4 text-center font-semibold text-indigo-700">Never</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">What We Log (And Why)</h2>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-xl bg-slate-50 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                  <span className="text-sm font-bold text-indigo-700">1</span>
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-slate-900">Transaction Hashes</h3>
                  <p className="text-sm text-slate-600">We record blockchain transaction hashes for credit deposits to enable refund dispute resolution.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-xl bg-slate-50 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                  <span className="text-sm font-bold text-indigo-700">2</span>
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-slate-900">Credit Balances</h3>
                  <p className="text-sm text-slate-600">We maintain credit balances per wallet address to enable pay-as-you-go inference.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-xl bg-slate-50 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                  <span className="text-sm font-bold text-indigo-700">3</span>
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-slate-900">API Request Metadata</h3>
                  <p className="text-sm text-slate-600">Timestamps and model identifiers (not content) are logged for debugging and rate limiting.</p>
                </div>
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-indigo-700">What we don&apos;t log:</span> Prompts, responses, or any content from your inference requests. The actual AI generation happens entirely on Venice&apos;s infrastructure.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">Built on Venice</h2>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-slate-600">
              OMA routes your inference requests to Venice AI, which operates under their own privacy policy. Venice is known for:
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                <CheckCircle className="h-5 w-5 shrink-0 text-indigo-700" />
                <span className="text-sm text-slate-700">Minimal prompt and response retention</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                <CheckCircle className="h-5 w-5 shrink-0 text-indigo-700" />
                <span className="text-sm text-slate-700">No training on user data</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                <CheckCircle className="h-5 w-5 shrink-0 text-indigo-700" />
                <span className="text-sm text-slate-700">Privacy-focused infrastructure</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                <CheckCircle className="h-5 w-5 shrink-0 text-indigo-700" />
                <span className="text-sm text-slate-700">Enterprise-grade security</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h2 className="mb-4 text-2xl font-bold text-slate-900">Start Privately</h2>
          <p className="mb-6 text-slate-600">
            No account. No KYC. Just connect your wallet and start inferring with minimal data footprint.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700">
              Get API Key
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
              Read Docs
            </Link>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-4 text-sm text-slate-600">
          <Link href="/compare/openrouter-alternative" className="hover:text-indigo-700">
            OpenRouter Alternative
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/compare/venice-ai-alternative" className="hover:text-indigo-700">
            Venice AI Alternative
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/crypto-payments" className="hover:text-indigo-700">
            Crypto Payments
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/pricing" className="hover:text-indigo-700">
            Pricing
          </Link>
        </div>
      </div>
    </div>
  )
}