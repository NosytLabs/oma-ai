import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Shield, Zap, CreditCard, Users, CheckCircle, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'OpenRouter Alternative for Private AI Inference',
  description: 'Discover OMA as a privacy-first alternative to OpenRouter. Venice-powered AI inference with crypto payments, no account required, and minimal data retention.',
  keywords: ['OpenRouter alternative', 'AI inference gateway', 'private AI', 'crypto AI API', 'Venice AI alternative'],
  openGraph: {
    title: 'OpenRouter Alternative for Private AI Inference | OMA AI',
    description: 'Privacy-first AI inference gateway. Venice-powered, crypto-native, low-friction access.',
    type: 'website',
  },
}

export default function OpenRouterAlternativePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600">
            <Shield className="h-4 w-4" />
            Privacy-First Alternative
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            OpenRouter Alternative for <span className="gradient-text">Private AI Inference</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            Tired of account requirements and data logging? OMA delivers Venice-powered AI inference with a privacy-first approach, crypto-native payments, and zero friction.
          </p>
        </div>

        <div className="mb-16 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
              <Shield className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-slate-900">Privacy-First by Design</h3>
            <p className="text-slate-600">
              Unlike OpenRouter, OMA operates with minimal data retention. Your API calls don&apos;t require an account, and we log only what&apos;s essential for service delivery.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
              <Zap className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-slate-900">Venice-Powered Backend</h3>
            <p className="text-slate-600">
              OMA routes requests through Venice, leveraging their robust infrastructure while adding intelligent routing, failover, and a credit system on top.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
              <CreditCard className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-slate-900">Crypto-Native Payments</h3>
            <p className="text-slate-600">
              Pay with 100+ cryptocurrencies directly. No credit cards, no bank accounts, no financial surveillance. Just wallet-to-wallet simplicity.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
              <Users className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-slate-900">Low-Friction Access</h3>
            <p className="text-slate-600">
              Connect your wallet and start inferring in seconds. No KYC, no email verification, no waiting period. Permissionless by default.
            </p>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">Why Developers Choose OMA</h2>
          <div className="space-y-4">
            {[
              'OpenAI-compatible API for easy migration',
              '50+ AI models including GPT-4, Claude, and Gemini',
              'Real-time credit system with full transparency',
              'No account required - wallet-only authentication',
              'Built on Base for fast, reliable transactions',
              'Dashboard for monitoring usage and costs',
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <CheckCircle className="h-5 w-5 shrink-0 text-indigo-600" />
                <span className="text-slate-600">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">Compare: OMA vs OpenRouter</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="p-4 text-left font-semibold text-slate-900">Feature</th>
                  <th className="p-4 text-center font-semibold text-slate-900">OpenRouter</th>
                  <th className="p-4 text-center font-semibold text-indigo-600">OMA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-4 text-slate-600">Account Required</td>
                  <td className="p-4 text-center text-slate-600">Yes</td>
                  <td className="p-4 text-center font-semibold text-indigo-600">No</td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="p-4 text-slate-600">KYC Verification</td>
                  <td className="p-4 text-center text-slate-600">Yes</td>
                  <td className="p-4 text-center font-semibold text-indigo-600">No</td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-600">Crypto Payments</td>
                  <td className="p-4 text-center text-slate-600">Limited</td>
                  <td className="p-4 text-center font-semibold text-indigo-600">100+ Tokens</td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="p-4 text-slate-600">Data Retention</td>
                  <td className="p-4 text-center text-slate-600">Full Logging</td>
                  <td className="p-4 text-center font-semibold text-indigo-600">Minimal</td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-600">Dashboard</td>
                  <td className="p-4 text-center text-slate-600">Yes</td>
                  <td className="p-4 text-center font-semibold text-indigo-600">Yes</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <h2 className="mb-4 text-2xl font-bold text-slate-900">Ready to Switch?</h2>
          <p className="mb-6 text-slate-600">
            Get started in seconds. Connect your wallet, deposit credits, and start building.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700">
              Get API Key
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-all hover:border-indigo-300 hover:text-indigo-600">
              Read Docs
            </Link>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-4 text-sm text-slate-500">
          <Link href="/compare/venice-ai-alternative" className="hover:text-indigo-600">
            Venice AI Alternative
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/private-ai-api" className="hover:text-indigo-600">
            Private AI API
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/crypto-payments" className="hover:text-indigo-600">
            Crypto Payments
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/pricing" className="hover:text-indigo-600">
            Pricing
          </Link>
        </div>
      </div>
    </div>
  )
}