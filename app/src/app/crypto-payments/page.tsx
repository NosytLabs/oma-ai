import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Coins, Wallet, Zap, Shield, ArrowRight, CheckCircle, Link2, Globe, Rocket, Lock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Pay for AI API with Crypto - OMA AI Credits',
  description: 'Purchase AI API credits with cryptocurrency. OMA supports 100+ tokens via Houdini-powered payments. Low-friction, privacy-first approach to paying for AI inference.',
  keywords: ['pay for AI API with crypto', 'crypto AI API', 'AI API cryptocurrency', 'Houdini swap', 'crypto payments AI', 'x402 payments', 'Solana AI payments'],
  openGraph: {
    title: 'Pay for AI API with Crypto | OMA AI Credits',
    description: 'Crypto-friendly AI API credits. 100+ tokens supported via Houdini-powered payments.',
    type: 'website',
  },
}

const SUPPORTED_TOKENS = [
  { name: 'ETH', symbol: 'ETH' },
  { name: 'USDC', symbol: 'USDC' },
  { name: 'USDT', symbol: 'USDT' },
  { name: 'DAI', symbol: 'DAI' },
  { name: 'WBTC', symbol: 'WBTC' },
  { name: 'OMA', symbol: 'OMA' },
  { name: 'SOL', symbol: 'SOL' },
  { name: 'MATIC', symbol: 'MATIC' },
]

const PAYMENT_FEATURES = [
  {
    icon: Coins,
    title: '100+ Supported Tokens',
    desc: 'Pay with ETH, USDC, USDT, DAI, WBTC, SOL, MATIC, OMA, and 100+ other tokens directly from your wallet.',
  },
  {
    icon: Zap,
    title: 'Houdini-Powered Payments',
    desc: 'Our Houdini integration ensures fast, reliable swaps with competitive rates and minimal slippage.',
  },
  {
    icon: Wallet,
    title: 'Self-Custody',
    desc: 'Your funds stay in your wallet until you authorize a deposit. No middlemen, no custody risk.',
  },
  {
    icon: Shield,
    title: 'Privacy-First',
    desc: 'Pay with crypto without linking wallet addresses to usage. Low-friction, privacy-preserving payments.',
  },
]

const X402_FEATURES = [
  {
    icon: Link2,
    title: 'Payment Links',
    desc: 'Generate shareable payment links for instant deposits. No wallet connection required for recipients.',
  },
  {
    icon: Rocket,
    title: 'Pay-Per-Request (x402)',
    desc: 'Native x402 protocol support on Solana and Base. Pay for API requests without pre-funding.',
  },
  {
    icon: Globe,
    title: 'Cross-Chain Support',
    desc: 'Seamless payments across Solana and Base chains via x402 protocol facilitators.',
  },
  {
    icon: Lock,
    title: 'Gasless Transactions',
    desc: 'x402 enables gasless AI inference payments with automatic fee delegation.',
  },
]

const WALLET_OPTIONS = [
  { name: 'MetaMask', desc: 'EVM wallets', icon: '🦊' },
  { name: 'Nightly', desc: 'Solana + EVM', icon: '🌙' },
  { name: 'Coinbase Wallet', desc: 'EVM wallets', icon: '💰' },
  { name: 'WalletConnect', desc: 'Multi-chain', icon: '🔗' },
]

export default function CryptoPaymentsPage() {
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
            <Coins className="h-4 w-4" />
            Crypto-Native Payments
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Pay for AI API with <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Crypto</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            Skip the credit card. Pay with 100+ cryptocurrencies directly from your wallet. Low-friction, privacy-first payments powered by Houdini Swap.
          </p>
        </div>

        <div className="mb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">Payment Features</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {PAYMENT_FEATURES.map((feature, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
                  <feature.icon className="h-6 w-6 text-indigo-700" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-slate-900">{feature.title}</h3>
                <p className="text-slate-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">x402 Protocol Support</h2>
          <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-6 shadow-sm">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-purple-100 px-4 py-2 text-sm font-medium text-purple-700">
                <Zap className="h-4 w-4" />
                Native x402 Protocol
              </div>
              <p className="text-slate-600">
                OMA AI supports the x402 payment protocol for seamless, gasless AI inference payments on Solana and Base chains.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {X402_FEATURES.map((feature, index) => (
                <div key={index} className="flex items-start gap-3 rounded-xl bg-white/80 p-4">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-100">
                    <feature.icon className="h-4 w-4 text-purple-700" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">{feature.title}</h4>
                    <p className="mt-1 text-sm text-slate-600">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-6 text-center text-2xl font-bold text-slate-900">Supported Tokens</h2>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 grid grid-cols-4 gap-4 sm:grid-cols-8">
              {SUPPORTED_TOKENS.map((token) => (
                <div
                  key={token.symbol}
                  className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 p-3 text-center"
                >
                  <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">
                    {token.symbol.slice(0, 2)}
                  </div>
                  <span className="text-xs font-medium text-slate-700">{token.symbol}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-slate-600">
              Plus 90+ additional tokens including major DeFi tokens, stablecoins, and emerging chains.
            </p>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-6 text-center text-2xl font-bold text-slate-900">Supported Wallets</h2>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {WALLET_OPTIONS.map((wallet) => (
                <div
                  key={wallet.name}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="text-2xl">{wallet.icon}</div>
                  <div>
                    <div className="font-medium text-slate-900">{wallet.name}</div>
                    <div className="text-xs text-slate-500">{wallet.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-sm text-slate-600">
              Nightly wallet enables both Solana and EVM (Base) connections via a single wallet.
            </p>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-6 text-center text-2xl font-bold text-slate-900">How It Works</h2>
          <div className="space-y-4">
            {[
              { step: '01', title: 'Connect Your Wallet', desc: 'Link any EVM-compatible wallet or Solana wallet via Nightly. No account required.' },
              { step: '02', title: 'Choose Your Token', desc: 'Select from 100+ supported tokens. Houdini handles the swap at competitive rates.' },
              { step: '03', title: 'Receive Credits', desc: 'Tokens are converted to OMA credits at current rates with full transparency.' },
              { step: '04', title: 'Start Inferring', desc: 'Use credits immediately for any supported model. No waiting, no approval needed.' },
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                  <p className="text-sm text-slate-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-6 text-center text-2xl font-bold text-slate-900">Payment Link Integration</h2>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Link2 className="h-5 w-5 text-indigo-500" />
              <h3 className="text-lg font-semibold text-slate-900">Generate Payment Links</h3>
            </div>
            <p className="mb-4 text-slate-600">
              Create shareable payment links for AI API access. Recipients can pay with crypto without needing to connect a wallet to your platform.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-slate-600">Houdini-powered payment links with privacy tunnel</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-slate-600">Automatic token conversion to USDC credits</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-slate-600">Customizable payment amounts and expiration</span>
              </div>
            </div>
            <Link href="/deposit" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700">
              Generate a payment link
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-6 text-center text-2xl font-bold text-slate-900">OMA Token Benefits</h2>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 text-center">
              <p className="text-slate-600">
                Paying with OMA tokens unlocks additional benefits for power users.
              </p>
            </div>
            <div className="space-y-3">
              {[
                '5% bonus credits on OMA deposits (subject to circuit breaker conditions)',
                'Up to 20% discount on inference costs when staking OMA',
                'Governance participation in future protocol decisions',
                'Priority access to new model releases',
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 shrink-0 text-indigo-700" />
                  <span className="text-slate-600">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h2 className="mb-4 text-2xl font-bold text-slate-900">Ready to Deposit?</h2>
          <p className="mb-6 text-slate-600">
            Deposit crypto and start using AI inference in minutes. No hidden fees, full transparency.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/deposit" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700">
              Deposit Crypto
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/swap" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
              Swap Tokens
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
          <Link href="/private-ai-api" className="hover:text-indigo-700">
            Private AI API
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