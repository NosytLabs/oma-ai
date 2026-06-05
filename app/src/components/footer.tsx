'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { OmaLogo } from '@/components/ui/oma-logo'
import { ApiStatus } from './api-status'

const FOOTER_NAV = [
  { label: 'models', href: '/models' },
  { label: 'pricing', href: '/pricing' },
  { label: 'docs', href: '/docs' },
  { label: 'playground', href: '/playground' },
  { label: 'dashboard', href: '/dashboard' },
  { label: 'deposit', href: '/deposit' },
  { label: 'terms', href: '/terms' },
  { label: 'privacy', href: '/privacy' },
]

export function Footer() {
  const year = new Date().getFullYear()
  const pathname = usePathname() ?? ''
  return (
    <footer aria-label="Site footer" className="border-t border-[var(--color-border)] bg-[var(--color-void)] font-mono">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid gap-10 lg:grid-cols-[2fr_3fr]">
          <div className="flex flex-col gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-sm w-fit"
            >
              <OmaLogo size="sm" />
              <span className="text-sm text-[var(--color-text-bright)] font-semibold">oma</span>
              <span className="text-[var(--color-text-muted)] text-xs">·sys</span>
            </Link>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-md">
              Permissionless AI inference. One key, every model, pay in crypto. No account required.
              <br />
              Base chain · mainnet. Built and operated by the OMA collective.
            </p>
            <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
              <ApiStatus showRetryButton={false} />
              <span className="hidden sm:inline">·</span>
              <a
                href="https://github.com/oma-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-sm transition-colors"
              >
                github.com/oma-ai
              </a>
              <span>·</span>
              <a
                href="https://twitter.com/oma_ai"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-sm transition-colors"
              >
                @oma_ai
              </a>
            </div>
          </div>

          <nav aria-label="Footer navigation" className="text-[11px]">
            <p className="text-[var(--color-text-muted)] mb-3 uppercase tracking-widest text-[10px]">Index</p>
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1.5">
              {FOOTER_NAV.map((link) => {
                const isCurrent = pathname === link.href || pathname.startsWith(link.href + '/')
                return (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    aria-current={isCurrent ? 'page' : undefined}
                    className="inline-flex items-center gap-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-sm transition-colors py-1"
                  >
                    <span className="text-[var(--color-text-muted)]" aria-hidden="true">·</span>
                    <span>{link.label}</span>
                  </Link>
                </li>
                )
              })}
            </ul>
          </nav>
        </div>

        <div className="mt-10 pt-5 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] leading-relaxed">
          <p>
            © {year} OMA AI · base chain // one man army · build {process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev'} · last deploy {new Date().toISOString().slice(0, 10)}
          </p>
          <p className="mt-1">
            Inference routes to upstream providers. Uptime is best-effort, not guaranteed. Verify before you bet on it.
          </p>
        </div>
      </div>
    </footer>
  )
}
