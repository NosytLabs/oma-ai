'use client'

import Link from 'next/link'
import { OmaLogo } from '@/components/ui/oma-logo'
import { ApiStatus } from './api-status'

const FOOTER_LINKS = [
  { label: 'Models', href: '/models' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '/docs' },
  { label: 'Playground', href: '/playground' },
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Admin', href: '/admin' },
  { label: 'Deposit', href: '/deposit' },
  { label: 'Crypto Payments', href: '/crypto-payments' },
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
]

export function Footer() {
  return (
    <footer aria-label="Site footer" className="border-t border-[var(--color-border)] bg-[var(--color-void)] font-mono text-xs">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-12">
          
          <div className="flex flex-col gap-6 max-w-sm">
            <Link href="/" className="inline-flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-sm">
              <OmaLogo size="sm" />
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold tracking-tight text-[var(--color-text-bright)] group-hover:text-[var(--color-accent)] transition-colors duration-150">OMA</span>
                <span className="text-[10px] tracking-widest text-[var(--color-text-muted)]">SYS</span>
              </div>
            </Link>
            
            <p className="text-[var(--color-text-secondary)] leading-relaxed">
              One Man Army. Permissionless inference gateway. Access 50+ models with crypto-native payments. No credit card required.
            </p>
            
            <ApiStatus showRetryButton={false} />
          </div>

          <div className="w-full lg:w-auto">
            <nav aria-label="Footer navigation">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-6 border-b border-[var(--color-border)] pb-2">
                Index
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-0">
              {FOOTER_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-[var(--color-text)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)] focus-visible:text-[var(--color-accent)] active:translate-y-px transition-all duration-150 rounded-sm flex min-h-10 items-center gap-3 py-2 pl-4 relative before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-px before:h-3 before:bg-[var(--color-text-muted)] before:opacity-40"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            </nav>
          </div>
          
        </div>

        <div className="mt-16 pt-6 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-[var(--color-text-muted)]">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-start">
            <span>© {new Date().getFullYear()} OMA AI</span>
            <span className="hidden sm:inline-block w-px h-3 bg-[var(--color-border)]" />
            <a href="https://github.com/oma-ai" target="_blank" rel="noopener noreferrer" aria-label="GitHub repository" className="inline-flex min-h-10 items-center hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)] rounded-sm transition-colors px-1 -mx-1">GITHUB</a>
            <a href="https://twitter.com/oma_ai" target="_blank" rel="noopener noreferrer" aria-label="Twitter account" className="inline-flex min-h-10 items-center hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)] rounded-sm transition-colors px-1 -mx-1">TWITTER</a>
          </div>
          <div className="uppercase tracking-widest">
            BASE_CHAIN // ONE MAN ARMY v1.0.0
          </div>
        </div>
      </div>
    </footer>
  )
}
