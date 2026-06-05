'use client'

import Link from 'next/link'
import { ArrowLeft, Coins, Wallet, Zap, Shield, ArrowRight, CheckCircle, Link2, Globe, Rocket, Lock } from 'lucide-react'

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
  { name: 'MetaMask', desc: 'EVM wallets' },
  { name: 'Nightly', desc: 'Solana + EVM' },
  { name: 'Coinbase Wallet', desc: 'EVM wallets' },
  { name: 'WalletConnect', desc: 'Multi-chain' },
]

const HOW_IT_STEPS = [
  { step: '01', title: 'Connect Your Wallet', desc: 'Link any EVM-compatible wallet or Solana wallet via Nightly. No account required.' },
  { step: '02', title: 'Choose Your Token', desc: 'Select from 100+ supported tokens. Houdini handles the swap at competitive rates.' },
  { step: '03', title: 'Receive Credits', desc: 'Tokens are converted to OMA credits at current rates with full transparency.' },
  { step: '04', title: 'Start Inferring', desc: 'Use credits immediately for any supported model. No waiting, no approval needed.' },
]

export default function CryptoPaymentsPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--color-void)] px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-xs font-mono text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-cyan)] hover:brightness-90"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/10 px-4 py-2 text-sm font-mono font-medium text-[var(--color-cyan)]">
            <Coins className="h-4 w-4" />
            Crypto-Native Payments
          </div>
          <h1 className="font-syne mb-4 text-4xl font-bold tracking-tight text-[var(--color-text)] md:text-5xl">
            Pay for AI API with <span className="text-[var(--color-cyan)]">Crypto</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-[var(--color-text-muted)]">
            Skip the credit card. Pay with 100+ cryptocurrencies directly from your wallet. Low-friction, privacy-first payments powered by Houdini Swap.
          </p>
        </div>

        <div className="mb-16">
          <h2 className="mb-8 text-center font-syne text-2xl font-bold text-[var(--color-text)]">Payment Features</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {PAYMENT_FEATURES.map((feature, index) => (
              <div key={index} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 transition-all hover:border-[var(--color-cyan)]/30">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-cyan)]/10">
                  <feature.icon className="h-6 w-6 text-[var(--color-cyan)]" />
                </div>
                <h3 className="mb-2 font-syne text-lg font-bold text-[var(--color-text)]">{feature.title}</h3>
                <p className="text-sm text-[var(--color-text-muted)]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-8 text-center font-syne text-2xl font-bold text-[var(--color-text)]">x402 Protocol Support</h2>
          <div className="rounded-xl border border-[var(--color-cyan)]/20 bg-gradient-to-br from-[var(--color-cyan)]/5 to-[var(--color-accent)]/5 p-6">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--color-cyan)]/10 px-4 py-2 text-sm font-mono font-medium text-[var(--color-cyan)]">
                <Zap className="h-4 w-4" />
                Native x402 Protocol
              </div>
              <p className="text-[var(--color-text-muted)]">
                OMA AI supports the x402 payment protocol for seamless, gasless AI inference payments on Solana and Base chains.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {X402_FEATURES.map((feature, index) => (
                <div key={index} className="flex items-start gap-3 rounded-xl bg-[var(--color-surface)]/50 p-4">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-cyan)]/10">
                    <feature.icon className="h-4 w-4 text-[var(--color-cyan)]" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[var(--color-text)]">{feature.title}</h4>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-6 text-center font-syne text-2xl font-bold text-[var(--color-text)]">Supported Tokens</h2>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
            <div className="mb-4 grid grid-cols-4 gap-4 sm:grid-cols-8">
              {SUPPORTED_TOKENS.map((token) => (
                <div
                  key={token.symbol}
                  className="flex flex-col items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center"
                >
                  <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-cyan)]/10 text-sm font-bold text-[var(--color-cyan)]">
                    {token.symbol.slice(0, 2)}
                  </div>
                  <span className="text-xs font-medium text-[var(--color-text)]">{token.symbol}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-[var(--color-text-muted)]">
              Plus 90+ additional tokens including major DeFi tokens, stablecoins, and emerging chains.
            </p>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-6 text-center font-syne text-2xl font-bold text-[var(--color-text)]">Supported Wallets</h2>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {WALLET_OPTIONS.map((wallet) => (
                <div
                  key={wallet.name}
                  className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-cyan)]/10 text-[var(--color-cyan)] font-mono font-bold text-sm">
                    {wallet.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium text-[var(--color-text)]">{wallet.name}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{wallet.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-sm text-[var(--color-text-muted)]">
              Nightly wallet enables both Solana and EVM (Base) connections via a single wallet.
            </p>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-6 text-center font-syne text-2xl font-bold text-[var(--color-text)]">How It Works</h2>
          <div className="space-y-4">
            {HOW_IT_STEPS.map((item, index) => (
              <div key={index} className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-cyan)] text-sm font-bold text-[var(--color-text-inverse)]">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--color-text)]">{item.title}</h3>
                  <p className="text-sm text-[var(--color-text-muted)]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-6 text-center font-syne text-2xl font-bold text-[var(--color-text)]">Payment Link Integration</h2>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
            <div className="mb-4 flex items-center gap-2">
              <Link2 className="h-5 w-5 text-[var(--color-cyan)]" />
              <h3 className="text-lg font-semibold text-[var(--color-text)]">Generate Payment Links</h3>
            </div>
            <p className="mb-4 text-[var(--color-text-muted)]">
              Create shareable payment links for AI API access. Recipients can pay with crypto without needing to connect a wallet to your platform.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-[var(--color-cyan)]" />
                <span className="text-[var(--color-text-muted)]">Houdini-powered payment links with privacy tunnel</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-[var(--color-cyan)]" />
                <span className="text-[var(--color-text-muted)]">Automatic token conversion to USDC credits</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-[var(--color-cyan)]" />
                <span className="text-[var(--color-text-muted)]">Customizable payment amounts and expiration</span>
              </div>
            </div>
            <Link href="/deposit" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-cyan)] hover:brightness-75">
              Generate a payment link
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="mb-6 text-center font-syne text-2xl font-bold text-[var(--color-text)]">OMA Token Benefits</h2>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
            <div className="mb-6 text-center">
              <p className="text-[var(--color-text-muted)]">
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
                  <CheckCircle className="h-5 w-5 shrink-0 text-[var(--color-cyan)]" />
                  <span className="text-[var(--color-text-muted)]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 text-center">
          <h2 className="mb-4 font-syne text-2xl font-bold text-[var(--color-text)]">Ready to Deposit?</h2>
          <p className="mb-6 text-[var(--color-text-muted)]">
              Deposit crypto and start using AI inference in minutes. No hidden fees, full transparency.
            </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/deposit" className="inline-flex items-center gap-2 rounded-full bg-[var(--color-cyan)] px-6 py-3 font-mono font-medium text-[var(--color-void)] shadow-lg shadow-[var(--color-cyan)]/20 transition-all hover:brightness-75 hover:-translate-y-0.5">
              Deposit Crypto
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/swap" className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-transparent px-6 py-3 font-mono font-medium text-[var(--color-text)] transition-all hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)] hover:brightness-90">
              Swap Tokens
            </Link>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-4 text-sm text-[var(--color-text-muted)]">
          <Link href="/compare/openrouter-alternative" className="hover:text-[var(--color-cyan)] hover:brightness-90">
            OpenRouter Alternative
          </Link>
          <span className="text-[var(--color-border)]">|</span>
          <Link href="/compare/venice-ai-alternative" className="hover:text-[var(--color-cyan)] hover:brightness-90">
            Venice AI Alternative
          </Link>
          <span className="text-[var(--color-border)]">|</span>
          <Link href="/private-ai-api" className="hover:text-[var(--color-cyan)] hover:brightness-90">
            Private AI API
          </Link>
          <span className="text-[var(--color-border)]">|</span>
          <Link href="/pricing" className="hover:text-[var(--color-cyan)] hover:brightness-90">
            Pricing
          </Link>
        </div>
      </div>
    </div>
  )
}
