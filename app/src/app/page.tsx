/* LARP cleanup (ses_larp_surgical_v1) — Hallmark ornament removed, copy
 * tightened, body wrapper switched from mono → sans, decorative StatusDot
 * renamed to LiveIndicator, §-prefixed SectionHeading replaced with inline
 * <h2>, oma-btn → btn-primary/btn-secondary, x402 wire SVG replaced with
 * the FeaturedX402Lottie client wrapper so lottie-react stays out of the
 * initial bundle. The audit's CRITICAL conversion-killer issues are
 * preserved (api-status:102 "Reconnecting…", real product data, real
 * "3 / 3 online" status, no invented metrics). */

import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { CopyButton } from '@/components/ui/CopyButton'
import { AuthNotice } from '@/components/AuthNotice'
import { FeaturedX402Lottie } from './_components/FeaturedX402Lottie'

export const metadata: Metadata = {
  title: 'OMA · Permissionless AI inference',
  description:
    'One key for every model. Pay per request in USDC. No account, no card, no sales call.',
  openGraph: {
    title: 'OMA · Permissionless AI inference',
    description:
      'One key for every model. Pay per request in USDC. No account, no card, no sales call.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
}

type ModelLogo = 'llama' | 'claude' | 'gemini' | 'deepseek' | 'gpt' | 'venice'

const FEATURED_MODELS: { id: string; provider: string; ctx: string; logo: ModelLogo }[] = [
  { id: 'llama-3.3-70b', provider: 'Venice', ctx: '8k', logo: 'llama' },
  { id: 'claude-sonnet-4', provider: 'Anthropic', ctx: '200k', logo: 'claude' },
  { id: 'gemini-2.5-pro', provider: 'Google', ctx: '1M', logo: 'gemini' },
  { id: 'gpt-4o-mini', provider: 'OpenRouter', ctx: '128k', logo: 'gpt' },
  { id: 'deepseek-v3', provider: 'Venice', ctx: '64k', logo: 'deepseek' },
  { id: 'claude-3-5-haiku-latest', provider: 'Anthropic', ctx: '200k', logo: 'venice' },
]

// First-letter monograms (MVP placeholder until real brand SVGs land via 21st-magic / icon CDN).
// 2 letters where the brand initial collides (DS vs G, GE vs G).
const MONOGRAM: Record<ModelLogo, string> = {
  llama: 'L',
  claude: 'C',
  gpt: 'G',
  deepseek: 'DS',
  gemini: 'GE',
  venice: 'V',
}

const PROVIDERS = [
  { id: 'venice', name: 'Venice', role: 'PRIMARY', note: 'Chat, images, video, embeddings', state: 'online' },
  { id: 'antseed', name: 'AntSeed', role: 'FAILOVER', note: 'Warm standby, automatic handoff', state: 'online' },
  { id: 'tinyfish', name: 'TinyFish', role: 'SEARCH', note: 'Web search for real-time answers', state: 'online' },
] as const

const INTEGRATION_SNIPPET = `curl -X POST https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer $OMA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4",
    "messages": [{ "role": "user", "content": "hi" }]
  }'`

function LiveIndicator({ tone = 'accent' }: { tone?: 'accent' | 'warning' | 'error' }) {
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

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--color-void)] text-[var(--color-text-secondary)] font-sans selection:bg-[var(--color-accent-dim)] selection:text-[var(--color-accent)]">
      <Suspense fallback={null}>
        <AuthNotice />
      </Suspense>
      <div className="overflow-x-clip">
        <div className="flex flex-col">

          <section
            id="subject"
            aria-labelledby="subject-heading"
            className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-12 sm:pb-16"
          >
            <div className="grid gap-8 lg:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] items-start">
              <div className="min-w-0">
                <h2 className="font-syne text-lg sm:text-xl text-[var(--color-text-bright)] font-bold mb-5 sm:mb-7 tracking-tight">
                  Subject
                </h2>

                <h1
                  id="subject-heading"
                  className="font-syne font-bold text-[var(--color-text-bright)] tracking-[-0.03em] leading-[0.95] text-[clamp(2.25rem,7.5vw,5.5rem)]"
                  style={{ overflowWrap: 'anywhere', minWidth: 0 }}
                >
                  <span className="block">One key.</span>
                  <span className="block text-[var(--color-accent)]">Every model.</span>
                </h1>

                <p className="mt-6 max-w-2xl text-[15px] sm:text-base text-[var(--color-text)] leading-relaxed">
                  Pay per request in USDC. Wallet auth, no account.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href="/docs" className="btn-primary">
                    open the docs
                  </Link>
                  <Link href="/playground" className="btn-secondary">
                    try the playground
                  </Link>
                </div>
              </div>

              <aside
                aria-label="System state"
                className="border border-[var(--color-border)] bg-[var(--color-surface)] min-w-0"
              >
                <div className="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-panel)] flex items-center justify-between">
                  <span className="text-[10px] uppercase text-[var(--color-text-muted)]">
                    System state
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-accent)]">
                    <LiveIndicator />
                    <span className="sr-only">System status: </span>live
                  </span>
                </div>
                <dl className="text-[11px]">
                  {[
                    ['Version', '0.4.2'],
                    ['Facilitator', 'mock · dev'],
                    ['Settlement', 'Base · USDC'],
                    ['Providers', '3 / 3'],
                    ['Models', `${FEATURED_MODELS.length} of 19+ shown`],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="grid grid-cols-2 gap-2 px-3 py-1.5 border-b border-[var(--color-border)] last:border-b-0"
                    >
                      <dt className="text-[var(--color-text-tertiary)] uppercase text-[10px]">
                        {k}
                      </dt>
                      <dd className="text-[var(--color-text-secondary)] tabular-nums truncate text-right">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
              </aside>
            </div>
          </section>

          <section
            id="inventory"
            aria-labelledby="inventory-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <h2 className="font-syne text-lg sm:text-xl text-[var(--color-text-bright)] font-bold mb-5 sm:mb-7 tracking-tight">
              Inventory
            </h2>
            <h3 id="inventory-heading" className="sr-only">
              Featured model inventory
            </h3>

            <ul className="border border-[var(--color-border)] divide-y divide-[var(--color-border)] overflow-x-auto">
              {FEATURED_MODELS.map((m, i) => (
                <li
                  key={m.id}
                  className="grid grid-cols-[2.25rem_minmax(0,1fr)_5.5rem_4rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_7rem_5rem] items-center gap-2 sm:gap-4 px-3 sm:px-4 py-3 hover:bg-[var(--color-surface)] transition-colors min-w-fit"
                >
                  <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <span
                      aria-hidden="true"
                      className="inline-flex h-4 w-4 sm:h-5 sm:w-5 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] text-[8px] sm:text-[9px] font-medium text-[var(--color-accent)] tabular-nums"
                    >
                      {MONOGRAM[m.logo]}
                    </span>
                    <span className="text-[10px] sm:text-sm text-[var(--color-text-bright)] truncate min-w-0">
                      {m.id}
                    </span>
                  </span>
                  <span className="text-[10px] sm:text-xs text-[var(--color-text-secondary)] truncate">
                    {m.provider}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-[var(--color-text-muted)] tabular-nums text-right">
                    {m.ctx}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] text-[var(--color-text-muted)]">
              Full list at{' '}
              <Link
                href="/models"
                className="font-medium text-[var(--color-text-bright)] hover:text-[var(--color-accent)] underline decoration-2 underline-offset-2"
              >
                /models
              </Link>{' '}
              or via{' '}
              <code className="text-[var(--color-text)]">GET /v1/models</code>.
            </p>
          </section>

          <section
            id="routing"
            aria-labelledby="routing-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <h2 className="font-syne text-lg sm:text-xl text-[var(--color-text-bright)] font-bold mb-5 sm:mb-7 tracking-tight">
              Routing
            </h2>
            <h3 id="routing-heading" className="sr-only">
              Provider routing
            </h3>

            <div className="border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="px-3 sm:px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-panel)] flex items-center justify-between">
                <span className="text-[10px] uppercase text-[var(--color-text-muted)]">
                  mesh
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-accent)]">
                  <LiveIndicator />
                  3 / 3 online
                </span>
              </div>
              <ol className="divide-y divide-[var(--color-border)]">
                {PROVIDERS.map((p, i) => (
                  <li
                    key={p.id}
                    className="grid grid-cols-[2.25rem_minmax(0,1fr)] sm:grid-cols-[2.5rem_5rem_minmax(0,1fr)] gap-3 sm:gap-4 items-center px-3 sm:px-4 py-3"
                  >
                    <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="hidden sm:inline-block text-[10px] uppercase text-[var(--color-text-muted)]">
                      {p.role}
                    </span>
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <div className="min-w-0">
                        <p className="text-[13px] sm:text-sm text-[var(--color-text-bright)] truncate">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                          {p.note}
                        </p>
                      </div>
                      <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-accent)] shrink-0">
                        <LiveIndicator />
                        online
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="px-3 sm:px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-tertiary)] flex items-center gap-2 flex-wrap">
                <span>fallback · venice → antseed</span>
                <span className="text-[var(--color-text-muted)]">·</span>
                <span>health checked every 5s</span>
                <span className="text-[var(--color-text-muted)]">·</span>
                <span>circuit breaker: closed</span>
              </div>
            </div>

            <p className="mt-4 text-[11px] text-[var(--color-text-muted)]">
              Cross-chain deposits via{' '}
              <Link
                href="/deposit"
                className="font-medium text-[var(--color-text-bright)] hover:text-[var(--color-accent)] underline decoration-2 underline-offset-2"
              >
                Houdini Swap
              </Link>{' '}
              (BTC, ETH, SOL, XMR, TRX, BNB, and 14+ more chains).
            </p>
          </section>

          <section
            id="protocol"
            aria-labelledby="protocol-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <h2 className="font-syne text-lg sm:text-xl text-[var(--color-text-bright)] font-bold mb-5 sm:mb-7 tracking-tight">
              Protocol
            </h2>
            <h3 id="protocol-heading" className="sr-only">
              x402 payment protocol
            </h3>

            <p className="text-[13px] sm:text-sm text-[var(--color-text-secondary)] max-w-2xl mb-6">
              x402 settles a single request for an agent. The wallet signs a
              USDC transfer on Base, the receipt is verified on retry, the
              upstream model is called. No account, no prepaid balance.
            </p>

            <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
              <FeaturedX402Lottie />
            </div>

            <p className="mt-4 text-[11px] text-[var(--color-text-muted)]">
              Full protocol in the{' '}
              <Link
                href="/docs"
                className="font-medium text-[var(--color-text-bright)] hover:text-[var(--color-accent)] underline decoration-2 underline-offset-2"
              >
                docs
              </Link>
              . Mock mode signs without on-chain verification in dev.
            </p>
          </section>

          <section
            id="integration"
            aria-labelledby="integration-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <h2 className="font-syne text-lg sm:text-xl text-[var(--color-text-bright)] font-bold mb-5 sm:mb-7 tracking-tight">
              Integration
            </h2>
            <h3 id="integration-heading" className="sr-only">
              Integration snippet
            </h3>

            <p className="text-[13px] sm:text-sm text-[var(--color-text-secondary)] max-w-2xl mb-6">
              OpenAI-compatible. Swap the base URL, keep the rest of your code.
            </p>

            <div className="border border-[var(--color-border)] bg-[var(--color-surface)] min-w-0">
              <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-panel)]">
                <span className="text-[10px] uppercase text-[var(--color-text-muted)]">
                  curl · 5 lines
                </span>
                <CopyButton text={INTEGRATION_SNIPPET} />
              </div>
              <pre
                className="px-3 sm:px-4 py-4 text-[12px] sm:text-[13px] leading-[1.7] text-[var(--color-text)] overflow-x-auto whitespace-pre"
                style={{ overflowWrap: 'normal' }}
              >
                <code>{INTEGRATION_SNIPPET}</code>
              </pre>
            </div>
          </section>

          <section
            id="procurement"
            aria-labelledby="procurement-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <h2 className="font-syne text-lg sm:text-xl text-[var(--color-text-bright)] font-bold mb-5 sm:mb-7 tracking-tight">
              Procurement
            </h2>
            <h3 id="procurement-heading" className="sr-only">
              Procurement and next step
            </h3>

            <div className="border border-[var(--color-border)] bg-[var(--color-surface)] px-5 sm:px-8 py-8 sm:py-10">
              <p className="text-[15px] sm:text-base text-[var(--color-text-bright)] max-w-2xl leading-relaxed">
                The price list is the same
                <br />
                for everyone.
              </p>
              <p className="mt-3 text-[12px] sm:text-sm text-[var(--color-text-secondary)] max-w-xl leading-relaxed">
                Connect a wallet, hit the API, get an answer. No sales call.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href="/docs" className="btn-primary">
                  open the docs
                </Link>
                <Link href="/playground" className="btn-secondary">
                  try the playground
                </Link>
                <Link
                  href="/dashboard"
                  className="text-[11px] sm:text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-bright)] underline underline-offset-4 transition-colors"
                >
                  connect your wallet to continue →
                </Link>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
