'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { OmaLogo } from '@/components/ui/oma-logo'
import { ApiStatus } from './api-status'

type FooterLink = { label: string; href: string }

type FooterSection = {
  title: string
  links: FooterLink[]
}

// Grouped site index. Section order = reading order on the page.
const FOOTER_SECTIONS: FooterSection[] = [
  {
    title: 'Product',
    links: [
      { label: 'models', href: '/models' },
      { label: 'playground', href: '/playground' },
      { label: 'pricing', href: '/pricing' },
      { label: 'docs', href: '/docs' },
      { label: 'dashboard', href: '/dashboard' },
    ],
  },
  {
    title: 'Tools',
    links: [
      { label: 'image gen', href: '/image-generation' },
      { label: 'video gen', href: '/video-generation' },
      { label: 'swap', href: '/swap' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'use cases', href: '/use-cases' },
      { label: 'compare', href: '/compare' },
      { label: 'faq', href: '/faq' },
      { label: 'private ai api', href: '/private-ai-api' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'about', href: '/about' },
      { label: 'deposit', href: '/deposit' },
      { label: 'admin', href: '/admin' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'terms', href: '/terms' },
      { label: 'privacy', href: '/privacy' },
      { label: 'crypto payments', href: '/crypto-payments' },
    ],
  },
]

export function Footer() {
  const year = new Date().getFullYear()
  const pathname = usePathname() ?? ''
  return (
    <footer aria-label="Site footer" className="border-t border-border bg-void font-mono">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid gap-10 lg:grid-cols-[2fr_3fr]">
          <div className="flex flex-col gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm w-fit"
            >
              <OmaLogo size="sm" />
              <span className="text-sm text-text-bright font-semibold">oma</span>
              <span className="text-text-muted text-xs">·sys</span>
            </Link>
            <p className="text-xs text-text-secondary leading-relaxed max-w-md">
              Permissionless AI inference. One key, every model, pay in crypto. No account required.
              <br />
              Base chain · mainnet. Built and operated by the OMA collective.
            </p>
            <div className="flex items-center gap-3 text-[11px] text-text-muted">
              <ApiStatus showRetryButton={false} />
              <span className="hidden sm:inline">·</span>
              <a
                href="https://github.com/oma-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm transition-colors"
              >
                github.com/oma-ai
              </a>
              <span>·</span>
              <a
                href="https://twitter.com/oma_ai"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm transition-colors"
              >
                @oma_ai
              </a>
            </div>
          </div>

          <nav aria-label="Footer navigation" className="text-[11px]">
            <p className="text-text-muted mb-3 uppercase tracking-widest text-[10px]">Index</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-6">
              {FOOTER_SECTIONS.map((section) => (
                <div key={section.title} className="min-w-0">
                  <p className="text-accent mb-2 uppercase tracking-widest text-[9px] font-semibold">
                    {section.title}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {section.links.map((link) => {
                      const isCurrent = pathname === link.href || pathname.startsWith(link.href + '/')
                      return (
                        <li key={link.label}>
                          <Link
                            href={link.href}
                            aria-current={isCurrent ? 'page' : undefined}
                            className="inline-flex items-center gap-1.5 text-text-secondary hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm transition-colors py-1"
                          >
                            <span className="text-text-muted" aria-hidden="true">·</span>
                            <span>{link.label}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
        </div>

        <div className="mt-10 pt-5 border-t border-border text-[10px] text-text-muted leading-relaxed">
          <p>
            © {year} OMA AI · base chain // one man army · build {process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7) ?? 'dev'} · last deploy {process.env.NEXT_PUBLIC_BUILD_DATE ?? 'dev'}
          </p>
          <p className="mt-1">
            Inference routes to upstream providers. Uptime is best-effort, not guaranteed. Verify before you bet on it.
          </p>
        </div>
      </div>
    </footer>
  )
}
