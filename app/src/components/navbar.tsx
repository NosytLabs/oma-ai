'use client'

/* Hallmark · P4 H5 E5 S5 R4 V4
 * nav: N6 inset-frame-with-title-bar · genre: atmospheric · theme: terminal
 * states (per interactive element):
 *   nav link    default · hover · focus-visible · active · current (aria-current)
 *   icon link   default · hover · focus-visible · active
 *   user button default · hover · focus-visible · active · expanded
 *   menu link   default · hover · focus-visible · active
 *   signout     default · hover · focus-visible · active
 *   hamburger   default · hover · focus-visible · active · expanded
 *   copy/version chips: default · hover (underline) · focus-visible
 * contrast: all text ≥ 4.5:1 on var(--color-void)
 */

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useWallet } from '@/components/wallet-context'
import { OmaLogo } from '@/components/ui/oma-logo'
import { Menu, X, ChevronDown, Key, Zap, Github } from 'lucide-react'
import { ApiStatus } from './api-status'
import { ConnectButton } from './connect-button'
import { ThemeToggle } from './ThemeToggle'

const navLinks = [
  { href: '/models', label: 'models' },
  { href: '/playground', label: 'playground' },
  { href: '/docs', label: 'docs' },
  { href: '/dashboard', label: 'dashboard' },
  { href: '/pricing', label: 'pricing' },
]

// Secondary destinations surfaced via the "more" dropdown to keep the bar
// from overflowing on standard laptop widths (1280-1440px).
const moreLinks = [
  { href: '/image-generation', label: 'image' },
  { href: '/video-generation', label: 'video' },
  { href: '/compare', label: 'compare' },
  { href: '/use-cases', label: 'use cases' },
  { href: '/swap', label: 'swap' },
  { href: '/about', label: 'about' },
  { href: '/admin', label: 'admin' },
]

function sectionLabelFor(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'home'
  const match = [...navLinks, ...moreLinks].find(
    l => pathname === l.href || pathname.startsWith(l.href + '/')
  )
  return match?.label ?? pathname.replace(/^\//, '').split('/')[0] ?? 'home'
}

export function Navbar() {
  const { evmAddress, isConnected, disconnect } = useWallet()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  useEffect(() => {
    setMobileOpen(false)
    setShowUserMenu(false)
    setShowMoreMenu(false)
  }, [pathname])

  // Close "more" menu when clicking outside
  const moreMenuRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!showMoreMenu) return
    function onDocClick(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowMoreMenu(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [showMoreMenu])

  const shortAddress = evmAddress ? `${evmAddress.slice(0, 6)}…${evmAddress.slice(-4)}` : ''
  const section = sectionLabelFor(pathname)
  const build = process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7) ?? 'dev'

  return (
    <header
      className="sticky top-0 left-0 right-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-void)]/95 backdrop-blur-md font-mono"
    >
      <nav aria-label="Main navigation" className="w-full">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-5">
          <div className="flex items-center justify-between gap-2 h-11 sm:h-12">
            <div className="flex items-center min-w-0 gap-2 sm:gap-3">
              <Link
                href="/"
                className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-sm shrink-0"
                aria-label="OMA home"
              >
                <OmaLogo size="sm" />
                <span className="text-[13px] sm:text-sm text-[var(--color-text-bright)] font-semibold tracking-tight">
                  oma
                </span>
                <span className="text-[var(--color-accent)]" aria-hidden="true">
                  ›
                </span>
              </Link>

              <span
                className="hidden sm:inline-block w-px h-3.5 bg-[var(--color-border-bright)]"
                aria-hidden="true"
              />

              <span
                className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] tabular-nums min-w-0"
                aria-label={`Current section: ${section}`}
              >
                <span className="text-[var(--color-text-tertiary)]">~</span>
                <span className="text-[var(--color-text-secondary)] truncate">
                  {section}
                </span>
              </span>

              <ul className="hidden lg:flex items-center gap-0.5 ml-2">
                {navLinks.map(link => {
                  const isActive =
                    pathname === link.href || pathname.startsWith(link.href + '/')
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group relative inline-flex items-center px-2 py-1 text-[12px] rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] transition-colors duration-150 ${
                          isActive
                            ? 'text-[var(--color-accent)]'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-bright)]'
                        }`}
                      >
                        <span className="text-[var(--color-text-tertiary)] mr-1" aria-hidden="true">
                          {isActive ? '●' : '○'}
                        </span>
                        {link.label}
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute left-2 right-2 -bottom-0.5 h-px origin-left scale-x-0 bg-[var(--color-accent)] transition-transform duration-200 ease-out ${
                            isActive
                              ? 'scale-x-100'
                              : 'group-hover:scale-x-100 group-focus-visible:scale-x-100'
                          }`}
                        />
                      </Link>
                    </li>
                  )
                })}
              </ul>

              <div className="hidden lg:block relative ml-0.5" ref={moreMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  aria-label={showMoreMenu ? 'Close more menu' : 'Open more menu'}
                  aria-expanded={showMoreMenu}
                  aria-haspopup="true"
                  className={`group relative inline-flex items-center gap-0.5 px-2 py-1 text-[12px] rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] transition-colors duration-150 ${
                    moreLinks.some(l => pathname === l.href || pathname.startsWith(l.href + '/'))
                      ? 'text-[var(--color-accent)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-bright)]'
                  }`}
                >
                  <span className="text-[var(--color-text-tertiary)] mr-1" aria-hidden="true">+</span>
                  more
                  <ChevronDown
                    className={`w-3 h-3 ml-0.5 text-[var(--color-text-muted)] transition-transform duration-150 ${
                      showMoreMenu ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {showMoreMenu && (
                  <div
                    role="menu"
                    aria-label="More destinations"
                    className="absolute left-0 mt-1.5 w-52 py-1 bg-[var(--color-void)] border border-[var(--color-border)] rounded-sm shadow-2xl shadow-[var(--color-overlay)] z-[60] font-mono"
                  >
                    {moreLinks.map(link => {
                      const isActive =
                        pathname === link.href || pathname.startsWith(link.href + '/')
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          role="menuitem"
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => setShowMoreMenu(false)}
                          className={`flex items-center gap-2 px-3 py-2 text-xs focus-visible:outline-none focus-visible:bg-[var(--color-surface)] transition-colors ${
                            isActive
                              ? 'text-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-bright)] hover:bg-[var(--color-surface)]'
                          }`}
                        >
                          <span aria-hidden="true" className="text-[var(--color-text-tertiary)]">
                            {isActive ? '●' : '○'}
                          </span>
                          <span>{link.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <a
                href="https://github.com/oma-ai"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub repository (opens in new tab)"
                className="hidden md:inline-flex items-center justify-center w-8 h-8 rounded-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-bright)] hover:bg-[var(--color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-95 transition-all duration-150"
              >
                <Github className="h-4 w-4" />
              </a>

              <ThemeToggle />

              <div className="hidden xl:flex items-center">
                <ApiStatus />
              </div>

              {isConnected ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-1.5 px-2.5 h-8 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-sm text-xs hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] transition-all"
                    aria-label="Open user menu"
                    aria-expanded={showUserMenu}
                    aria-haspopup="true"
                  >
                    <span
                      className="relative flex h-1.5 w-1.5"
                      aria-hidden="true"
                    >
                      <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75 animate-ping" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--color-accent)]" />
                    </span>
                    <span className="text-[var(--color-text)] font-mono">{shortAddress}</span>
                    <ChevronDown
                      className={`w-3 h-3 text-[var(--color-text-muted)] transition-transform duration-150 ${
                        showUserMenu ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {showUserMenu && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-1.5 w-60 py-1 bg-[var(--color-void)] border border-[var(--color-border)] rounded-sm shadow-2xl shadow-[var(--color-overlay)] z-[60] font-mono"
                    >
                      <div className="px-3 py-2 border-b border-[var(--color-border)] mb-1">
                        <p className="text-[9px] uppercase tracking-widest text-[var(--color-text-tertiary)]">
                          Active session
                        </p>
                        <p className="text-xs text-[var(--color-accent)] mt-0.5 truncate">
                          {evmAddress}
                        </p>
                      </div>
                      <Link
                        href="/dashboard"
                        role="menuitem"
                        className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-bright)] hover:bg-[var(--color-surface)] focus-visible:outline-none focus-visible:bg-[var(--color-surface)] focus-visible:text-[var(--color-text-bright)] transition-colors"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <Key className="w-3 h-3" aria-hidden="true" />
                        <span>api keys</span>
                      </Link>
                      <Link
                        href="/deposit"
                        role="menuitem"
                        className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-bright)] hover:bg-[var(--color-surface)] focus-visible:outline-none focus-visible:bg-[var(--color-surface)] focus-visible:text-[var(--color-text-bright)] transition-colors"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <Zap className="w-3 h-3" aria-hidden="true" />
                        <span>add credits</span>
                      </Link>
                      <div className="h-px bg-[var(--color-border)] my-1" aria-hidden="true" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          disconnect()
                          setShowUserMenu(false)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-error)]/80 hover:text-[var(--color-error)] hover:bg-[var(--color-error-dim)] focus-visible:outline-none focus-visible:bg-[var(--color-error-dim)] focus-visible:text-[var(--color-error)] transition-colors text-left"
                      >
                        <span>terminate session</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="scale-90 origin-right">
                  <ConnectButton />
                </div>
              )}

              <button
                type="button"
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-bright)] hover:bg-[var(--color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-95 transition-all"
                aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={mobileOpen}
                aria-controls="mobile-menu"
              >
                {mobileOpen ? (
                  <X className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Menu className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        {mobileOpen && (
          <div
            id="mobile-menu"
            className="lg:hidden border-t border-[var(--color-border)] bg-[var(--color-void)] font-mono"
          >
            <div className="mx-auto w-full max-w-6xl px-3 sm:px-5 py-3">
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-tertiary)] mb-2">
                index
              </p>
              <ul className="flex flex-col gap-0.5">
                {navLinks.map(link => {
                  const isActive =
                    pathname === link.href || pathname.startsWith(link.href + '/')
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`flex items-center justify-between px-3 py-2.5 text-sm rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] transition-colors ${
                          isActive
                            ? 'text-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-bright)] hover:bg-[var(--color-surface)]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span aria-hidden="true" className="text-[var(--color-text-tertiary)]">
                            {isActive ? '●' : '○'}
                          </span>
                          {link.label}
                        </span>
                        <span className="text-[var(--color-text-tertiary)] text-xs" aria-hidden="true">
                          →
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-tertiary)] mt-3 mb-2">
                more
              </p>
              <ul className="flex flex-col gap-0.5">
                {moreLinks.map(link => {
                  const isActive =
                    pathname === link.href || pathname.startsWith(link.href + '/')
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`flex items-center justify-between px-3 py-2.5 text-sm rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] transition-colors ${
                          isActive
                            ? 'text-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-bright)] hover:bg-[var(--color-surface)]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span aria-hidden="true" className="text-[var(--color-text-tertiary)]">
                            {isActive ? '●' : '○'}
                          </span>
                          {link.label}
                        </span>
                        <span className="text-[var(--color-text-tertiary)] text-xs" aria-hidden="true">
                          →
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-[10px] text-[var(--color-text-tertiary)]">
                <span>build {build}</span>
                <a
                  href="https://github.com/oma-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--color-text-bright)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-sm"
                >
                  github ↗
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
