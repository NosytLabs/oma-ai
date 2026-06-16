'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useWallet } from '@/components/wallet-context'
import dynamic from 'next/dynamic'
import { OmaLogo } from '@/components/ui/oma-logo'
import { Menu, X, Key, Zap, Settings, Github, Activity, LogOut } from 'lucide-react'
import { ApiStatus } from './api-status'

const ImprovedConnectButton = dynamic(
  () => import('./ui/ImprovedConnectButton').then(m => m.ImprovedConnectButton),
  { ssr: false }
)
import { ThemeToggle } from './ThemeToggle'

const primaryLinks = [
  { href: '/models', label: 'models' },
  { href: '/playground', label: 'playground' },
  { href: '/docs', label: 'docs' },
  { href: '/pricing', label: 'pricing' },
  { href: '/dashboard', label: 'dashboard' },
]

const secondaryLinks = [
  { href: '/image-generation', label: 'image' },
  { href: '/video-generation', label: 'video' },
  { href: '/compare', label: 'compare' },
  { href: '/use-cases', label: 'use cases' },
  { href: '/swap', label: 'swap' },
  { href: '/about', label: 'about' },
]

const opsLinks = [
  { href: '/admin', label: 'admin' },
]

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function sectionLabelFor(pathname: string) {
  if (pathname === '/' || pathname === '') return 'home'
  return [...primaryLinks, ...secondaryLinks, ...opsLinks]
    .find(link => isCurrentPath(pathname, link.href))
    ?.label
    .replace(/^\//, '')
    .split('/')[0] ?? 'home'
}

export function Navbar() {
  const { evmAddress, isConnected, disconnect } = useWallet()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const pathname = usePathname()
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const mobileMenuRef = useRef<HTMLDivElement | null>(null)
  const mobileToggleRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  useEffect(() => {
    setMobileOpen(false)
    setShowUserMenu(false)
  }, [pathname])

  useEffect(() => {
    if (!showUserMenu) return
    function onDocClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowUserMenu(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [showUserMenu])

  // Mobile menu focus trap (a11y): focus first item on open, trap Tab/Shift+Tab,
  // close on Escape, restore focus to toggle on close.
  useEffect(() => {
    if (!mobileOpen) return

    const menu = mobileMenuRef.current
    if (!menu) return

    const getFocusables = () =>
      menu.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )

    getFocusables()[0]?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setMobileOpen(false)
        return
      }
      if (e.key !== 'Tab') return
      const all = getFocusables()
      if (all.length === 0) {
        e.preventDefault()
        return
      }
      const first = all[0]
      const last = all[all.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const toggleToRestore = mobileToggleRef.current

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      toggleToRestore?.focus()
    }
  }, [mobileOpen])

  const shortAddress = evmAddress ? `${evmAddress.slice(0, 6)}…${evmAddress.slice(-4)}` : ''
  const section = sectionLabelFor(pathname)
  const build = process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7) ?? 'dev'

  return (
    <header className="sticky top-0 left-0 right-0 z-50 border-b border-border bg-void/95 backdrop-blur-md font-mono">
      <nav aria-label="Main navigation" className="w-full">
        <div className="mx-auto flex h-11 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="OMA home"
            >
              <OmaLogo size="sm" />
              <span className="text-sm font-semibold text-text-bright tracking-tight">oma</span>
            </Link>

              <span className="hidden xl:inline-flex min-w-0 items-center gap-1 text-[11px] sm:text-xs text-text-muted tabular-nums" aria-label={`Current section: ${section}`}>
              <span className="text-text-tertiary">/</span>
              <span className="truncate">{section}</span>
            </span>

            <ul className="hidden md:flex items-center gap-0.5">
              {primaryLinks.map(link => {
                const isActive = isCurrentPath(pathname, link.href)
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`inline-flex h-8 items-center rounded-sm px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        isActive
                          ? 'text-accent bg-accent-dim'
                          : 'text-text-secondary hover:bg-surface hover:text-text-bright'
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <a
              href="https://github.com/oma-ai"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository (opens in new tab)"
              className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Github className="h-4 w-4" />
            </a>

            <a
              href="/api/health"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Status page (opens in new tab)"
              className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Activity className="h-4 w-4" />
            </a>

            <ThemeToggle />

            {/* D-C1 fix: persistent Settings link for all auth methods
                (EVM, account-number, demo). The user-menu above is only
                rendered when an EVM wallet is connected. */}
            <Link
              href="/settings"
              aria-label="Settings"
              className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Link>

            <div className="hidden xl:flex items-center">
              <ApiStatus />
            </div>

            {isConnected ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="inline-flex h-9 items-center gap-2 rounded-sm border border-border bg-surface px-2.5 text-xs text-text transition-colors hover:border-accent/60 hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Open user menu"
                  aria-expanded={showUserMenu}
                  aria-haspopup="menu"
                  aria-controls="user-menu"
                >
                  <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
                  </span>
                  <span className="max-w-[6rem] truncate font-mono">{shortAddress}</span>
                </button>

                {showUserMenu && (
                  <div
                    id="user-menu"
                    role="menu"
                    className="absolute right-0 mt-2 w-56 rounded-sm border border-border bg-void py-1 font-mono shadow-xl shadow-overlay z-[60]"
                  >
                    <div className="border-b border-border px-3 py-2">
                      <p className="text-[9px] uppercase tracking-widest text-text-tertiary">Active session</p>
                      <p className="mt-0.5 truncate text-xs text-accent">{evmAddress}</p>
                    </div>
                    <Link
                      href="/dashboard"
                      role="menuitem"
                      className="flex items-center gap-2 px-3 py-2 text-xs text-text-secondary transition-colors hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:bg-surface focus-visible:text-text-bright"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Key className="h-3 w-3" aria-hidden="true" />
                      <span>api keys</span>
                    </Link>
                    <Link
                      href="/deposit"
                      role="menuitem"
                      className="flex items-center gap-2 px-3 py-2 text-xs text-text-secondary transition-colors hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:bg-surface focus-visible:text-text-bright"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Zap className="h-3 w-3" aria-hidden="true" />
                      <span>add credits</span>
                    </Link>
                    <Link
                      href="/settings"
                      role="menuitem"
                      className="flex items-center gap-2 px-3 py-2 text-xs text-text-secondary transition-colors hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:bg-surface focus-visible:text-text-bright"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Settings className="h-3 w-3" aria-hidden="true" />
                      <span>settings</span>
                    </Link>
                    <div className="my-1 h-px bg-border" aria-hidden="true" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={async () => {
                        // D-C1 fix: invalidate the server-side JWT before
                        // the client-side wallet disconnect. Otherwise the
                        // server still has a valid session for up to 7 days
                        // and the user is "logged out" client-side only.
                        try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }) } catch {}
                        disconnect()
                        setShowUserMenu(false)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-error/80 transition-colors hover:bg-error-dim hover:text-error focus-visible:outline-none focus-visible:bg-error-dim focus-visible:text-error"
                    >
                      <LogOut className="h-3 w-3" aria-hidden="true" />
                      terminate session
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <ImprovedConnectButton />
            )}

            <button
              ref={mobileToggleRef}
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
            >
              {mobileOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div
            ref={mobileMenuRef}
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            className="border-t border-border bg-void font-mono md:hidden"
          >
            <div className="mx-auto flex max-w-6xl flex-col px-4 py-3 sm:px-6">
              <div className="mb-3 flex items-center justify-between gap-3 text-[11px] text-text-muted">
                <span className="truncate">Current: {section}</span>
                <span className="shrink-0">build {build}</span>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-[10px] sm:text-xs uppercase tracking-widest text-text-tertiary">primary</p>
                  <ul className="space-y-0.5">
                    {primaryLinks.map(link => {
                      const isActive = isCurrentPath(pathname, link.href)
                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            onClick={() => setMobileOpen(false)}
                            aria-current={isActive ? 'page' : undefined}
                            className={`flex items-center justify-between rounded-sm px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                              isActive
                                ? 'bg-accent-dim text-accent'
                                : 'text-text-secondary hover:bg-surface hover:text-text-bright'
                            }`}
                          >
                            {link.label}
                            <span className="text-xs text-text-tertiary" aria-hidden="true">→</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <div>
                  <p className="mb-1 text-[10px] sm:text-xs uppercase tracking-widest text-text-tertiary">tools</p>
                  <ul className="space-y-0.5">
                    {secondaryLinks.map(link => {
                      const isActive = isCurrentPath(pathname, link.href)
                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            onClick={() => setMobileOpen(false)}
                            aria-current={isActive ? 'page' : undefined}
                            className={`flex items-center justify-between rounded-sm px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                              isActive
                                ? 'bg-accent-dim text-accent'
                                : 'text-text-secondary hover:bg-surface hover:text-text-bright'
                            }`}
                          >
                            {link.label}
                            <span className="text-xs text-text-tertiary" aria-hidden="true">→</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <div>
                  <p className="mb-1 text-[10px] sm:text-xs uppercase tracking-widest text-text-tertiary">ops</p>
                  <ul className="space-y-0.5">
                    {opsLinks.map(link => {
                      const isActive = isCurrentPath(pathname, link.href)
                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            onClick={() => setMobileOpen(false)}
                            aria-current={isActive ? 'page' : undefined}
                            className={`flex items-center justify-between rounded-sm px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                              isActive
                                ? 'bg-accent-dim text-accent'
                                : 'text-text-secondary hover:bg-surface hover:text-text-bright'
                            }`}
                          >
                            {link.label}
                            <span className="text-xs text-text-tertiary" aria-hidden="true">→</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-[11px] text-text-muted">
                <ApiStatus />
                <a
                  href="https://github.com/oma-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
