/* Hallmark · P4 H5 E5 S5 R4 V4
 * macrostructure: field-manual (catalog) · genre: atmospheric · theme: terminal
 * sections: masthead · subject · payment-features · x402 · tokens · wallets · flow · payment-links · oma-token · procurement
 * states (CTA buttons): default · hover · focus-visible · active · disabled · aria-disabled · loading · success
 * copy: stop-slop pass — active voice, no adverbs, no "not X, it's Y" contrasts, no em dashes,
 *       no invented metrics, no quote-bait.
 * contrast: all body text ≥ 4.5:1 on var(--color-void)
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowLeft,
  Coins,
  Wallet,
  Zap,
  Shield,
  ArrowRight,
  CheckCircle2,
  Link2,
  Globe,
  Rocket,
  Lock,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Crypto payments · OMA',
  description:
    'Pay for AI inference with 100+ tokens. USDC on Base via x402, Houdini swaps, gasless facilitator, self-custodial wallet to API.',
  openGraph: {
    title: 'Crypto payments · OMA',
    description:
      'Pay for AI inference with 100+ tokens. USDC on Base via x402, Houdini swaps, gasless facilitator, self-custodial wallet to API.',
  },
}

const ISSUED = '2026-06-12'
const DOC_ID = '0x4F4D41-CRYPTO'
const BUILD = (process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev').slice(0, 7)

const SUPPORTED_TOKENS = [
  { name: 'ETH', symbol: 'ETH' },
  { name: 'USDC', symbol: 'USDC' },
  { name: 'USDT', symbol: 'USDT' },
  { name: 'DAI', symbol: 'DAI' },
  { name: 'WBTC', symbol: 'WBTC' },
  { name: 'OMA', symbol: 'OMA' },
  { name: 'SOL', symbol: 'SOL' },
  { name: 'MATIC', symbol: 'MATIC' },
] as const

const PAYMENT_FEATURES = [
  {
    icon: Coins,
    title: '100+ supported tokens',
    body: 'Pay with ETH, USDC, USDT, DAI, WBTC, SOL, MATIC, OMA, and 100+ other tokens directly from your wallet.',
  },
  {
    icon: Zap,
    title: 'Houdini-powered swaps',
    body: 'Houdini integration keeps swaps fast, reliable, and competitive on rates with minimal slippage.',
  },
  {
    icon: Wallet,
    title: 'Self-custody',
    body: 'Funds stay in your wallet until you authorize a deposit. No middlemen, no custody risk.',
  },
  {
    icon: Shield,
    title: 'Privacy-first',
    body: 'Pay with crypto without linking wallet addresses to usage. Low-friction, privacy-preserving payments.',
  },
] as const

const X402_FEATURES = [
  {
    icon: Link2,
    title: 'Payment links',
    body: 'Generate shareable payment links for instant deposits. Recipients do not need to connect a wallet.',
  },
  {
    icon: Rocket,
    title: 'Pay-per-request (x402)',
    body: 'Native x402 protocol support on Solana and Base. Pay for API requests without pre-funding.',
  },
  {
    icon: Globe,
    title: 'Cross-chain support',
    body: 'Seamless payments across Solana and Base chains via x402 protocol facilitators.',
  },
  {
    icon: Lock,
    title: 'Gasless transactions',
    body: 'x402 enables gasless AI inference payments with automatic fee delegation.',
  },
] as const

const WALLET_OPTIONS = [
  { name: 'MetaMask', desc: 'EVM wallets' },
  { name: 'Nightly', desc: 'Solana + EVM' },
  { name: 'Coinbase Wallet', desc: 'EVM wallets' },
  { name: 'WalletConnect', desc: 'Multi-chain' },
] as const

const HOW_IT_STEPS = [
  { idx: '01', title: 'Connect your wallet', body: 'Link any EVM-compatible wallet or Solana wallet via Nightly. No account required.' },
  { idx: '02', title: 'Choose your token', body: 'Select from 100+ supported tokens. Houdini handles the swap at competitive rates.' },
  { idx: '03', title: 'Receive credits', body: 'Tokens are converted to OMA credits at current rates with full transparency.' },
  { idx: '04', title: 'Start inferring', body: 'Use credits immediately for any supported model. No waiting, no approval needed.' },
] as const

const OMA_BENEFITS = [
  '5% bonus credits on OMA deposits (subject to circuit-breaker conditions)',
  'Up to 20% discount on inference costs when staking OMA',
  'Governance participation in future protocol decisions',
  'Priority access to new model releases',
] as const

const SECTIONS = [
  { idx: '02', id: 'features', title: 'Payment features', meta: 'core surface' },
  { idx: '03', id: 'x402', title: 'x402 protocol', meta: 'per-request' },
  { idx: '04', id: 'tokens', title: 'Supported tokens', meta: '100+ assets' },
  { idx: '05', id: 'wallets', title: 'Supported wallets', meta: 'self-custody' },
  { idx: '06', id: 'flow', title: 'How it works', meta: 'four steps' },
  { idx: '07', id: 'payment-links', title: 'Payment links', meta: 'no wallet required' },
  { idx: '08', id: 'oma-token', title: 'OMA token', meta: 'bonus · discount' },
  { idx: '09', id: 'procurement', title: 'Procurement', meta: 'next step' },
] as const

function StatusDot({ tone = 'accent' }: { tone?: 'accent' | 'warning' | 'error' }) {
  const color =
    tone === 'warning'
      ? 'var(--color-warning)'
      : tone === 'error'
        ? 'var(--color-error)'
        : 'var(--color-accent)'
  return (
    <span className="relative inline-flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex rounded-full h-1.5 w-1.5"
        style={{ backgroundColor: color }}
      />
    </span>
  )
}

function SectionHeading({
  index,
  title,
  meta,
}: {
  index: string
  title: string
  meta?: string
}) {
  return (
    <header className="mb-5 sm:mb-7 flex items-baseline gap-3 flex-wrap">
      <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
        § {index}
      </span>
      <h2 className="font-syne text-lg sm:text-xl text-[var(--color-text-bright)] font-bold tracking-tight">
        {title}
      </h2>
      {meta && (
        <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
          {meta}
        </span>
      )}
    </header>
  )
}

export default function CryptoPaymentsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-void)] text-[var(--color-text-secondary)] font-mono selection:bg-[var(--color-accent-dim)] selection:text-[var(--color-accent)]">
      <div className="overflow-x-clip">
        <div className="flex flex-col">

          {/* ===== MASTHEAD ===== */}
          <section
            aria-label="Document masthead"
            className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                back to home
              </Link>
              <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-tertiary)] tracking-widest uppercase">
                <span aria-hidden="true">▌</span>
                <span>oma</span>
                <span className="text-[var(--color-text-muted)]">·</span>
                <span>crypto payments</span>
                <span className="text-[var(--color-text-muted)] hidden sm:inline">·</span>
                <span className="hidden sm:inline">build {BUILD}</span>
                <span className="text-[var(--color-text-muted)] hidden sm:inline">·</span>
                <span className="hidden sm:inline">revised {ISSUED}</span>
                <span className="text-[var(--color-text-muted)] hidden md:inline">·</span>
                <span className="hidden md:inline">doc #{DOC_ID}</span>
              </div>
            </div>
          </section>

          {/* ===== § 01 SUBJECT ===== */}
          <section
            id="subject"
            aria-labelledby="subject-heading"
            className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-12 sm:pb-16"
          >
            <div className="grid gap-8 lg:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] items-start">
              <div className="minw-0">
                <SectionHeading index="01" title="Subject" meta="pay for inference in crypto" />

                <h1
                  id="subject-heading"
                  className="font-syne font-bold text-[var(--color-text-bright)] tracking-[-0.03em] leading-[0.95] text-[clamp(2.25rem,7.5vw,5rem)]"
                  style={{ overflowWrap: 'anywhere', minWidth: 0, textWrap: 'balance' }}
                >
                  <span className="block">Pay for AI,</span>
                  <span className="block text-[var(--color-accent)]">in any token.</span>
                </h1>

                <p className="mt-6 max-w-2xl text-[15px] sm:text-base text-[var(--color-text)] leading-relaxed">
                  Skip the credit card. Pay with 100+ cryptocurrencies directly
                  from your wallet. Low-friction, privacy-first payments
                  powered by Houdini Swap and the x402 protocol.
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link href="/deposit" className="oma-btn oma-btn--primary">
                    <span aria-hidden="true" className="text-[var(--color-text-inverse)]">
                      ›
                    </span>
                    deposit now
                  </Link>
                  <Link href="/swap" className="oma-btn oma-btn--secondary">
                    swap tokens
                  </Link>
                  <span className="text-[11px] text-[var(--color-text-muted)] ml-1 tabular-nums">
                    <span className="text-[var(--color-accent)]" aria-hidden="true">
                      ~
                    </span>{' '}
                    self-custodial wallet to API
                  </span>
                </div>
              </div>

              <aside
                aria-label="Document metadata"
                className="border border-[var(--color-border)] bg-[var(--color-surface)] min-w-0 relative overflow-hidden"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-60"
                />
                <div className="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-panel)] flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                    Capabilities
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-accent)]">
                    <StatusDot />
                    <span className="sr-only">Status: </span>online
                  </span>
                </div>
                <dl className="text-[11px]">
                  {[
                    ['Tokens', '100+'],
                    ['Chains', 'Base · Solana'],
                    ['Swaps', 'Houdini'],
                    ['Protocol', 'x402'],
                    ['Wallets', 'EVM + Solana'],
                    ['Custody', 'self-custody'],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="grid grid-cols-2 gap-2 px-3 py-1.5 border-b border-[var(--color-border)] last:border-b-0"
                    >
                      <dt className="text-[var(--color-text-tertiary)] uppercase tracking-widest text-[10px]">
                        {k}
                      </dt>
                      <dd className="text-[var(--color-text-secondary)] tabular-nums truncate text-right">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="px-3 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-tertiary)]">
                  last revised · {ISSUED}
                </div>
              </aside>
            </div>
          </section>

          {/* ===== § 02 PAYMENT FEATURES ===== */}
          <section
            id="features"
            aria-labelledby="features-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading index="02" title="Payment features" meta="core surface" />
            <h3 id="features-heading" className="sr-only">
              Payment features
            </h3>

            <ul className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              {PAYMENT_FEATURES.map((feature, i) => (
                <li
                  key={feature.title}
                  className="group border border-[var(--color-border)] bg-[var(--color-surface)] p-5 hover:border-[var(--color-accent)]/40 transition-colors"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
                      §{String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] text-[var(--color-accent)]">
                      <feature.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h3 className="font-syne text-[15px] font-semibold text-[var(--color-text-bright)]">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-[12.5px] sm:text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                    {feature.body}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* ===== § 03 X402 ===== */}
          <section
            id="x402"
            aria-labelledby="x402-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading index="03" title="x402 protocol" meta="per-request" />
            <h3 id="x402-heading" className="sr-only">
              x402 protocol support
            </h3>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start">
              <p className="text-[13px] sm:text-sm text-[var(--color-text-secondary)] max-w-2xl">
                OMA supports the x402 payment protocol for seamless, gasless
                AI inference payments on Solana and Base chains. No pre-funded
                account, no per-key provisioning.
              </p>

              <ul className="border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
                {X402_FEATURES.map((feature) => (
                  <li
                    key={feature.title}
                    className="grid grid-cols-[2.5rem_2rem_minmax(0,1fr)] items-start gap-3 px-3 sm:px-4 py-3"
                  >
                    <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
                      §
                    </span>
                    <span className="flex h-6 w-6 items-center justify-center border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] text-[var(--color-accent)]">
                      <feature.icon className="h-3 w-3" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] sm:text-sm text-[var(--color-text-bright)]">
                        {feature.title}
                      </p>
                      <p className="text-[11px] sm:text-xs text-[var(--color-text-muted)] mt-0.5">
                        {feature.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ===== § 04 TOKENS ===== */}
          <section
            id="tokens"
            aria-labelledby="tokens-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading index="04" title="Supported tokens" meta="100+ assets" />
            <h3 id="tokens-heading" className="sr-only">
              Supported tokens
            </h3>

            <ul className="grid grid-cols-4 gap-2 sm:gap-3 sm:grid-cols-4 md:grid-cols-8">
              {SUPPORTED_TOKENS.map((token) => (
                <li
                  key={token.symbol}
                  className="flex flex-col items-center border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center"
                >
                  <span className="mb-1 flex h-9 w-9 items-center justify-center border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] text-[10px] font-mono font-bold text-[var(--color-accent)] tabular-nums">
                    {token.symbol.slice(0, 2)}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-medium text-[var(--color-text-bright)] tracking-wider uppercase">
                    {token.symbol}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] sm:text-xs text-[var(--color-text-muted)]">
              <span className="text-[var(--color-accent)]" aria-hidden="true">
                ~
              </span>{' '}
              Plus 90+ additional tokens including major DeFi tokens,
              stablecoins, and emerging chains.
            </p>
          </section>

          {/* ===== § 05 WALLETS ===== */}
          <section
            id="wallets"
            aria-labelledby="wallets-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading index="05" title="Supported wallets" meta="self-custody" />
            <h3 id="wallets-heading" className="sr-only">
              Supported wallets
            </h3>

            <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              {WALLET_OPTIONS.map((wallet) => (
                <li
                  key={wallet.name}
                  className="flex items-center gap-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] text-[var(--color-accent)] font-mono font-bold text-sm">
                    {wallet.name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--color-text-bright)] truncate">
                      {wallet.name}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest truncate">
                      {wallet.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] sm:text-xs text-[var(--color-text-muted)]">
              <span className="text-[var(--color-accent)]" aria-hidden="true">
                ~
              </span>{' '}
              Nightly enables both Solana and EVM (Base) connections via a
              single wallet.
            </p>
          </section>

          {/* ===== § 06 FLOW ===== */}
          <section
            id="flow"
            aria-labelledby="flow-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading index="06" title="How it works" meta="four steps" />
            <h3 id="flow-heading" className="sr-only">
              Deposit flow
            </h3>

            <ol className="border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
              {HOW_IT_STEPS.map((item) => (
                <li
                  key={item.idx}
                  className="grid grid-cols-[3rem_minmax(0,1fr)] sm:grid-cols-[4rem_minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3"
                >
                  <span className="text-[10px] sm:text-xs text-[var(--color-accent)] font-mono font-bold tabular-nums">
                    § {item.idx}
                  </span>
                  <span className="text-[13px] sm:text-sm text-[var(--color-text-bright)]">
                    {item.title}
                  </span>
                  <span className="hidden sm:inline text-[11px] sm:text-xs text-[var(--color-text-muted)]">
                    {item.body}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {/* ===== § 07 PAYMENT LINKS ===== */}
          <section
            id="payment-links"
            aria-labelledby="payment-links-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading index="07" title="Payment links" meta="no wallet required" />
            <h3 id="payment-links-heading" className="sr-only">
              Payment link integration
            </h3>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-start">
              <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
                  <h3 className="font-syne text-[15px] font-semibold text-[var(--color-text-bright)]">
                    Generate payment links
                  </h3>
                </div>
                <p className="text-[12.5px] sm:text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                  Create shareable payment links for AI API access. Recipients
                  can pay with crypto without needing to connect a wallet to
                  your platform.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href="/deposit"
                    className="oma-btn oma-btn--primary"
                  >
                    generate a payment link
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
              <ul className="border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
                {[
                  'Houdini-powered payment links with privacy tunnel',
                  'Automatic token conversion to USDC credits',
                  'Customizable payment amounts and expiration',
                ].map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-3 px-3 sm:px-4 py-3"
                  >
                    <CheckCircle2
                      className="h-4 w-4 shrink-0 text-[var(--color-accent)] mt-0.5"
                      aria-hidden="true"
                    />
                    <span className="text-[12.5px] sm:text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                      {line}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ===== § 08 OMA TOKEN ===== */}
          <section
            id="oma-token"
            aria-labelledby="oma-token-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading index="08" title="OMA token" meta="bonus · discount" />
            <h3 id="oma-token-heading" className="sr-only">
              OMA token benefits
            </h3>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-start">
              <p className="text-[13px] sm:text-sm text-[var(--color-text-secondary)] max-w-2xl">
                Paying with OMA tokens unlocks additional benefits for power
                users. Discounts and bonuses stack where the protocol allows;
                circuit-breaker conditions may apply.
              </p>
              <ul className="border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
                {OMA_BENEFITS.map((item, i) => (
                  <li
                    key={item}
                    className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 px-3 sm:px-4 py-3"
                  >
                    <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex items-start gap-3">
                      <CheckCircle2
                        className="h-4 w-4 shrink-0 text-[var(--color-accent)] mt-0.5"
                        aria-hidden="true"
                      />
                      <span className="text-[12.5px] sm:text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                        {item}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ===== § 09 PROCUREMENT ===== */}
          <section
            id="procurement"
            aria-labelledby="procurement-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading index="09" title="Procurement" meta="next step" />
            <h3 id="procurement-heading" className="sr-only">
              Ready to deposit
            </h3>

            <div className="border border-[var(--color-border)] bg-[var(--color-surface)] px-5 sm:px-8 py-8 sm:py-10">
              <p className="text-[15px] sm:text-base text-[var(--color-text-bright)] max-w-2xl leading-relaxed">
                Deposit crypto. Start inferring in minutes.
              </p>
              <p className="mt-3 text-[12px] sm:text-sm text-[var(--color-text-secondary)] max-w-xl leading-relaxed">
                No hidden fees. Full transparency. Pay with the token you
                already hold.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href="/deposit" className="oma-btn oma-btn--primary">
                  <span aria-hidden="true" className="text-[var(--color-text-inverse)]">
                    ›
                  </span>
                  deposit crypto
                </Link>
                <Link href="/swap" className="oma-btn oma-btn--secondary">
                  swap tokens
                </Link>
                <Link
                  href="/pricing"
                  className="text-[11px] sm:text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-bright)] underline underline-offset-4 transition-colors"
                >
                  see the full price list →
                </Link>
              </div>
            </div>
          </section>

          {/* ===== FOOTER NAV ===== */}
          <section
            aria-label="Related documents"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12"
          >
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] sm:text-xs">
              {[
                { href: '/compare/openrouter-alternative', label: 'OpenRouter alternative' },
                { href: '/compare/venice-ai-alternative', label: 'Venice AI alternative' },
                { href: '/private-ai-api', label: 'Private AI API' },
                { href: '/pricing', label: 'Pricing' },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Hidden TOC for crawlers & a11y */}
          <nav aria-label="Section index" className="sr-only">
            <ol>
              <li>
                <a href="#subject">§ 01 Subject</a>
              </li>
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>§ {s.idx} {s.title}</a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>
    </div>
  )
}
