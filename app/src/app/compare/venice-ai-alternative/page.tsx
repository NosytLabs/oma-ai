import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Layers, LayoutDashboard, RefreshCw, ArrowRight, CheckCircle, CreditCard } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Venice AI Alternative - Gateway Layer for Easy Access',
  description: 'OMA provides an intelligent gateway layer on top of Venice AI. Enjoy credits, dashboard analytics, smart routing, and a more accessible developer experience.',
  keywords: ['Venice AI alternative', 'Venice API gateway', 'AI inference gateway', 'Venice credits', 'AI API dashboard'],
  openGraph: {
    title: 'Venice AI Alternative - Gateway Layer for Easy Access | OMA AI',
    description: 'An intelligent layer on top of Venice AI with credits, dashboards, and smart routing.',
    type: 'website',
  },
}

export default function VeniceAIAlternativePage() {
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
            <Layers className="h-4 w-4" />
            Gateway Layer
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Venice AI Alternative - <span className="gradient-text">Gateway Layer for Easy Access</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            OMA sits on top of Venice AI, adding intelligent routing, credit management, and a developer-friendly dashboard while maintaining Venice&apos;s powerful inference capabilities.
          </p>
        </div>

        <div className="mb-16 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
              <CreditCard className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">Credits System</h3>
            <p className="text-sm text-slate-600">
              Pre-purchase credits with crypto and pay per token. No need to manage multiple transactions or worry about per-request crypto fees.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
              <LayoutDashboard className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">Dashboard Analytics</h3>
            <p className="text-sm text-slate-600">
              Track usage, monitor costs, and analyze model performance through an intuitive dashboard built for developers.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
              <RefreshCw className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">Smart Routing</h3>
            <p className="text-sm text-slate-600">
              Intelligent request routing with automatic failover ensures your applications stay running even if a backend experiences issues.
            </p>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">What OMA Adds to Venice</h2>
          <div className="space-y-4">
            {[
              { title: 'Credit System', desc: 'Pre-purchase tokens and pay as you go without per-request blockchain overhead' },
              { title: 'Unified Dashboard', desc: 'Monitor usage, costs, and model performance in one place' },
              { title: 'Smart Routing', desc: 'Automatic failover and load balancing across Venice infrastructure' },
              { title: 'OMA Token Staking', desc: 'Stake OMA tokens for up to 20% discount on inference costs' },
              { title: 'Developer Tools', desc: 'OpenAI-compatible API, making migration from other providers seamless' },
              { title: '100+ Crypto Tokens', desc: 'Pay with any of 100+ supported cryptocurrencies via Houdini Swap' },
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

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm mb-16">
          <h2 className="mb-6 text-center text-2xl font-bold text-slate-900">Still Powered by Venice</h2>
          <p className="mb-4 text-center text-slate-600">
            OMA doesn&apos;t replace Venice—it enhances it. When you use OMA, your requests still route through Venice AI&apos;s infrastructure, benefiting from their:
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <h3 className="mb-2 font-semibold text-slate-900">High-Quality Models</h3>
              <p className="text-sm text-slate-600">Access to Claude 3.5, GPT-4, Gemini Pro, and other leading models through Venice</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <h3 className="mb-2 font-semibold text-slate-900">Reliable Infrastructure</h3>
              <p className="text-sm text-slate-600">Venice&apos;s established data centers and redundancy ensure consistent uptime</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <h3 className="mb-2 font-semibold text-slate-900">Privacy-Focused</h3>
              <p className="text-sm text-slate-600">Venice&apos;s commitment to minimal data logging complements OMA&apos;s approach</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <h3 className="mb-2 font-semibold text-slate-900">Competitive Pricing</h3>
              <p className="text-sm text-slate-600">OMA passes through Venice&apos;s competitive model pricing with our credit markup</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <h2 className="mb-4 text-2xl font-bold text-slate-900">Start Using OMA Today</h2>
          <p className="mb-6 text-slate-600">
            Get the Venice experience with added convenience. No account needed—just connect your wallet.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700">
              Get Started
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
          <Link href="/crypto-payments" className="hover:text-indigo-600">
            Crypto Payments
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/private-ai-api" className="hover:text-indigo-600">
            Private AI API
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