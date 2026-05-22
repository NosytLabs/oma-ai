import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Coins, ArrowRight, CheckCircle, TrendingDown, Wallet } from 'lucide-react'

export const metadata: Metadata = {
  title: 'CheapTokens Alternative - Affordable AI Inference with Crypto',
  description: 'Looking for a CheapTokens alternative? OMA offers competitive AI inference pricing with 100+ crypto tokens, no account required, and a transparent credit system.',
  keywords: ['CheapTokens alternative', 'cheap AI API', 'crypto AI inference', 'low cost AI models', 'affordable AI tokens'],
  openGraph: {
    title: 'CheapTokens Alternative - Affordable AI Inference | OMA AI',
    description: 'Get AI inference at competitive rates with crypto payments and no account required.',
    type: 'website',
  },
}

export default function CheapTokensAlternativePage() {
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
            <Coins className="h-4 w-4" />
            Cost-Effective AI
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            CheapTokens Alternative for <span className="gradient-text">Affordable AI Inference</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            Get competitive AI inference pricing without the friction. OMA delivers transparent pricing, crypto-native payments, and a credit system that works for developers.
          </p>
        </div>

        <div className="mb-16 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
              <TrendingDown className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">Competitive Rates</h3>
            <p className="text-sm text-slate-600">
              OMA passes through Venice&apos;s competitive model pricing with a transparent credit system. No hidden fees or surprise charges.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
              <Wallet className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">Crypto-Native Payments</h3>
            <p className="text-sm text-slate-600">
              Pay with 100+ cryptocurrencies. No credit cards needed. Wallet-to-wallet simplicity with no financial surveillance.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
              <Coins className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">Stake for Discounts</h3>
            <p className="text-sm text-slate-600">
              Stake OMA tokens to receive up to 20% discount on inference costs. The more you stake, the more you save.
            </p>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">Why OMA Beats CheapTokens</h2>
          <div className="space-y-4">
            {[
              { title: 'No Account Required', desc: 'Connect your wallet and start inferring in seconds. No email, no waiting period. Low-friction access for builders.' },
              { title: '100+ Crypto Tokens', desc: 'Pay with any supported cryptocurrency via Houdini Swap integration.' },
              { title: 'Credit System', desc: 'Pre-purchase credits and pay as you go without per-request blockchain overhead.' },
              { title: 'Staking Discounts', desc: 'Up to 20% discount when you stake OMA tokens for inference credits.' },
              { title: 'OpenAI-Compatible API', desc: 'Easy migration from CheapTokens or other providers with our OpenAI-compatible endpoint.' },
              { title: 'Dashboard Analytics', desc: 'Track usage, monitor costs, and analyze model performance in real-time.' },
            ].map((item, index) => (
              <div key={index} className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
                <div>
                  <span className="font-semibold text-slate-900">{item.title}: </span>
                  <span className="text-slate-600">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">Compare: OMA vs CheapTokens</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="p-4 text-left font-semibold text-slate-900">Feature</th>
                  <th className="p-4 text-center font-semibold text-slate-900">CheapTokens</th>
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
                  <td className="p-4 text-slate-600">Crypto Payments</td>
                  <td className="p-4 text-center text-slate-600">Limited</td>
                  <td className="p-4 text-center font-semibold text-indigo-600">100+ Tokens</td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-600">Staking Discounts</td>
                  <td className="p-4 text-center text-slate-600">No</td>
                  <td className="p-4 text-center font-semibold text-indigo-600">Up to 20%</td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="p-4 text-slate-600">Credit System</td>
                  <td className="p-4 text-center text-slate-600">No</td>
                  <td className="p-4 text-center font-semibold text-indigo-600">Yes</td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-600">Dashboard</td>
                  <td className="p-4 text-center text-slate-600">Limited</td>
                  <td className="p-4 text-center font-semibold text-indigo-600">Full Analytics</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <h2 className="mb-4 text-2xl font-bold text-slate-900">Start Saving on AI Inference</h2>
          <p className="mb-6 text-slate-600">
            Get competitive pricing with the convenience of crypto payments and no account required.
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
          <Link href="/compare/openrouter-alternative" className="hover:text-indigo-600">
            OpenRouter Alternative
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/compare/venice-ai-alternative" className="hover:text-indigo-600">
            Venice AI Alternative
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/pricing" className="hover:text-indigo-600">
            Pricing
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/private-ai-api" className="hover:text-indigo-600">
            Private AI API
          </Link>
        </div>
      </div>
    </div>
  )
}