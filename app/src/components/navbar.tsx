'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useWallet } from '@/components/wallet-context'
import { OmaLogo } from '@/components/ui/oma-logo'
import {
  Menu,
  X,
  Key,
  Zap,
  Settings,
  Github,
  LogOut,
  ChevronDown,
  Box,
  Terminal,
  Tag,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  ArrowLeftRight,
  Info,
  CornerDownLeft,
  Wand2,
} from 'lucide-react'
import { ApiStatus } from './api-status'
import { m, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Magnetic,
  EASE_OUT,
  EASE_SPRING,
  EASE_SPRING_SOFT,
  staggerContainer,
} from '@/lib/motion'

import { Web3ConnectButton } from './web3'
import { ThemeToggle } from './ThemeToggle'

/* ============================================================
   SITE INDEX — single source of truth for navbar + footer
   ============================================================ */

type IconCmp = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>

type NavItem = {
  href: string
  label: string
  icon: IconCmp
  desc?: string
}

/** Primary nav (visible at all times, both desktop + mobile) */
const primaryLinks: NavItem[] = [
  { href: '/models',      label: 'models',     icon: Box,        desc: 'browse models' },
  { href: '/playground',  label: 'playground', icon: Terminal,   desc: 'try it live' },
  { href: '/pricing',     label: 'pricing',    icon: Tag,        desc: 'transparent cost' },
  { href: '/docs',        label: 'docs',       icon: FileText,   desc: 'api reference' },
]

/** Tools dropdown — secondary, off the primary path */
const toolsLinks: NavItem[] = [
  { href: '/image-generation', label: 'image',     icon: ImageIcon,       desc: 'text → image' },
  { href: '/video-generation', label: 'video',     icon: VideoIcon,       desc: 'text → video' },
  { href: '/swap',             label: 'swap',      icon: ArrowLeftRight,  desc: 'token exchange' },
  { href: '/about',            label: 'about',     icon: Info,            desc: 'who we are' },
]

const allLinks: NavItem[] = [...primaryLinks, ...toolsLinks]

/** Group definitions for the mobile menu cards */
type NavGroup = {
  title: string
  caption: string
  links: NavItem[]
}

const mobileGroups: NavGroup[] = [
  {
    title: 'product',
    caption: 'core surfaces',
    links: primaryLinks,
  },
  {
    title: 'tools',
    caption: 'modality + utility',
    links: toolsLinks,
  },
]

/* ============================================================
   HELPERS
   ============================================================ */

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function sectionLabelFor(pathname: string) {
  if (pathname === '/' || pathname === '') return 'home'
  return allLinks
    .find(link => isCurrentPath(pathname, link.href))
    ?.label
    .replace(/^\//, '')
    .split('/')[0] ?? 'home'
}

// Mobile link stagger variant — subtle slide-in from the left.
const mobileLinkVariant = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE_OUT } },
} as const

/* ============================================================
   NAVBAR
   ============================================================ */

export function Navbar() {
  const { evmAddress, isConnected, disconnect } = useWallet()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const prefersReduced = useReducedMotion()
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const mobileMenuRef = useRef<HTMLDivElement | null>(null)
  const mobileToggleRef = useRef<HTMLButtonElement | null>(null)
  const toolsRef = useRef<HTMLDivElement | null>(null)
  const toolsToggleRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  useEffect(() => {
    setMobileOpen(false)
    setShowUserMenu(false)
    setToolsOpen(false)
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

  /** Tools dropdown: click outside + Escape close + restore focus */
  useEffect(() => {
    if (!toolsOpen) return
    function onDocClick(e: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setToolsOpen(false)
        toolsToggleRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [toolsOpen])

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

  // Scroll-driven glass + border glow. Passive + rAF-throttled.
  useEffect(() => {
    let ticking = false
    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 10)
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const shortAddress = evmAddress ? `${evmAddress.slice(0, 6)}…${evmAddress.slice(-4)}` : ''
  const section = sectionLabelFor(pathname)
  const build = process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7) ?? 'dev'
  const isToolsActive = toolsLinks.some(l => isCurrentPath(pathname, l.href))

  // Pre-compute mobile-menu card active states so the JSX stays clean and
  // we can highlight the card that contains the current page.
  const accountHrefs = ['/dashboard', '/deposit', '/settings', '/docs']
  const isAccountCardActive = accountHrefs.some(href => isCurrentPath(pathname, href))

  return (
    <header
      className={`sticky top-0 left-0 right-0 z-50 border-b font-mono transition-colors duration-300 ${
        scrolled
          ? 'glass-strong border-accent/20'
          : 'border-border bg-void/95 backdrop-blur-md'
      }`}
    >
      <nav aria-label="Main navigation" className="w-full">
        <div className="mx-auto flex h-11 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          {/* LEFT: logo + section breadcrumb + primary links + tools dropdown */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Magnetic strength={6}>
              <Link
                href="/"
                className="inline-flex shrink-0 items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="OMA home"
              >
                <OmaLogo size="sm" />
                <span className="text-sm font-semibold text-text-bright tracking-tight">oma</span>
              </Link>
            </Magnetic>

            <span
              aria-hidden="true"
              className="hidden xl:inline-block h-3 w-px bg-border"
            />

            <span
              className="hidden xl:inline-flex min-w-0 items-center gap-1 text-[11px] sm:text-xs text-text-muted tabular-nums"
              aria-label={`Current section: ${section}`}
            >
              <span className="text-text-tertiary">~/</span>
              <span className="truncate text-text-secondary">{section}</span>
            </span>

            {/* Primary links (desktop) */}
            <ul className="hidden md:flex items-center gap-0.5">
              {primaryLinks.map(link => {
                const Icon = link.icon
                const isActive = isCurrentPath(pathname, link.href)
                return (
                  <li key={link.href} className="relative">
                    <m.div
                      whileHover={prefersReduced ? undefined : { y: -1 }}
                      whileTap={prefersReduced ? undefined : { scale: 0.96 }}
                      transition={EASE_SPRING}
                      className="inline-block"
                    >
                      <Link
                        href={link.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={`relative inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          isActive
                            ? 'text-accent'
                            : 'text-text-secondary hover:text-text-bright'
                        }`}
                      >
                        {isActive && (
                          <m.span
                            layoutId="nav-active"
                            aria-hidden="true"
                            className="absolute inset-0 rounded-sm bg-accent-dim"
                            transition={EASE_SPRING_SOFT}
                          />
                        )}
                        <Icon className="relative z-10 h-3 w-3 opacity-70" aria-hidden="true" />
                        <span className="relative z-10">{link.label}</span>
                      </Link>
                    </m.div>
                  </li>
                )
              })}
            </ul>

            {/* Tools dropdown (desktop) */}
            <div ref={toolsRef} className="relative hidden md:block">
              <m.div
                whileHover={prefersReduced ? undefined : { y: -1 }}
                whileTap={prefersReduced ? undefined : { scale: 0.96 }}
                transition={EASE_SPRING}
                className="inline-block"
              >
                <button
                  ref={toolsToggleRef}
                  type="button"
                  onClick={() => setToolsOpen(v => !v)}
                  aria-haspopup="menu"
                  aria-expanded={toolsOpen}
                  aria-controls="tools-menu"
                  aria-label="Tools menu"
                  className={`relative inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isToolsActive
                      ? 'text-accent'
                      : 'text-text-secondary hover:text-text-bright'
                  }`}
                >
                  {isToolsActive && !toolsOpen && (
                    <m.span
                      layoutId="nav-active"
                      aria-hidden="true"
                      className="absolute inset-0 rounded-sm bg-accent-dim"
                      transition={EASE_SPRING_SOFT}
                    />
                  )}
                  <Wand2 className="relative z-10 h-3 w-3 opacity-70" aria-hidden="true" />
                  <span className="relative z-10">tools</span>
                  <ChevronDown
                    className={`relative z-10 h-3 w-3 opacity-60 transition-transform duration-200 ${
                      toolsOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </m.div>

              <AnimatePresence>
                {toolsOpen && (
                  <m.div
                    key="tools-menu"
                    id="tools-menu"
                    role="menu"
                    initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
                    animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                    exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
                    transition={EASE_SPRING_SOFT}
                    style={{ transformOrigin: 'top left' }}
                    className="absolute left-0 top-full mt-2 w-72 rounded-sm border border-border bg-void/95 backdrop-blur-md p-1.5 shadow-2xl shadow-overlay font-mono z-[60]"
                  >
                    <p className="px-2.5 pt-1.5 pb-1 text-[9px] uppercase tracking-widest text-text-tertiary">
                      tools
                    </p>
                    <ul className="space-y-0.5">
                      {toolsLinks.map(link => {
                        const Icon = link.icon
                        const isActive = isCurrentPath(pathname, link.href)
                        return (
                          <li key={link.href} role="none">
                            <Link
                              href={link.href}
                              role="menuitem"
                              onClick={() => setToolsOpen(false)}
                              aria-current={isActive ? 'page' : undefined}
                              className={`group/item flex items-start gap-2.5 rounded-sm px-2.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                isActive
                                  ? 'bg-accent-dim text-accent'
                                  : 'text-text-secondary hover:bg-surface hover:text-text-bright'
                              }`}
                            >
                              <Icon
                                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                                  isActive ? 'text-accent' : 'text-text-muted group-hover/item:text-accent'
                                }`}
                                aria-hidden="true"
                              />
                              <span className="flex min-w-0 flex-col">
                                <span className="text-xs leading-tight">{link.label}</span>
                                {link.desc && (
                                  <span className="text-[10px] text-text-muted leading-tight mt-0.5">
                                    {link.desc}
                                  </span>
                                )}
                              </span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* RIGHT: actions */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <m.a
              href="https://github.com/oma-ai"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository (opens in new tab)"
              whileHover={prefersReduced ? undefined : { y: -1 }}
              whileTap={prefersReduced ? undefined : { scale: 0.94 }}
              transition={EASE_SPRING}
              className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Github className="h-4 w-4" />
            </m.a>

            <ThemeToggle />

            {/* Persistent Settings shortcut (also reachable from user menu) */}
            <m.div
              whileHover={prefersReduced ? undefined : { y: -1 }}
              whileTap={prefersReduced ? undefined : { scale: 0.94 }}
              transition={EASE_SPRING}
              className="inline-block"
            >
              <Link
                href="/settings"
                aria-label="Settings"
                className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
              </Link>
            </m.div>

            <div className="hidden xl:flex items-center">
              <ApiStatus />
            </div>

            {isConnected ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className={`inline-flex h-9 items-center gap-2 rounded-sm border bg-surface px-2.5 text-xs text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    showUserMenu
                      ? 'border-accent/60 bg-panel'
                      : 'border-border hover:border-accent/60 hover:bg-panel'
                  }`}
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

                <AnimatePresence>
                  {showUserMenu && (
                    <m.div
                      key="user-menu"
                      id="user-menu"
                      role="menu"
                      initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: -6 }}
                      animate={prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                      exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: -6 }}
                      transition={EASE_SPRING}
                      style={{ transformOrigin: 'top right' }}
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
                          try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }) } catch {}
                          disconnect()
                          setShowUserMenu(false)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-error/80 transition-colors hover:bg-error-dim hover:text-error focus-visible:outline-none focus-visible:bg-error-dim focus-visible:text-error"
                      >
                        <LogOut className="h-3 w-3" aria-hidden="true" />
                        terminate session
                      </button>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Magnetic strength={6}>
                <Web3ConnectButton />
              </Magnetic>
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

        {/* MOBILE MENU — grouped card layout */}
        <AnimatePresence>
          {mobileOpen && (
            <m.div
              key="mobile-menu"
              ref={mobileMenuRef}
              id="mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
              initial={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={prefersReduced ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
              exit={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="overflow-hidden border-t border-border bg-void font-mono md:hidden"
            >
              <div className="mx-auto flex max-w-6xl flex-col px-4 py-3 sm:px-6">
                {/* Status row */}
                <div className="mb-3 flex items-center justify-between gap-3 text-[11px] text-text-muted">
                  <span className="truncate">
                    <span className="text-text-tertiary">~/ </span>
                    <span className="text-text-secondary">{section}</span>
                  </span>
                  <span className="shrink-0">build {build}</span>
                </div>

                {/* Grouped card grid */}
                <div className="space-y-3">
                  {mobileGroups.map((group, gi) => {
                    const isCardActive = group.links.some(link => isCurrentPath(pathname, link.href))
                    return (
                    <m.div
                      key={group.title}
                      initial="hidden"
                      animate="show"
                      variants={staggerContainer(0.04, gi * 0.05)}
                      className={`rounded-sm border bg-surface/40 p-2 transition-colors ${
                        isCardActive ? 'border-accent/40' : 'border-border'
                      }`}
                    >
                      <div className="mb-1.5 flex items-baseline justify-between px-1">
                        <p className="text-[10px] sm:text-xs uppercase tracking-widest text-accent font-semibold flex items-center gap-1.5">
                          {group.title}
                          {isCardActive && (
                            <span
                              className="h-1 w-1 rounded-full bg-accent"
                              aria-label="Current section"
                            />
                          )}
                        </p>
                        <p className="text-[10px] text-text-tertiary tabular-nums">
                          {group.caption}
                        </p>
                      </div>
                      <m.ul className="grid grid-cols-2 gap-1">
                        {group.links.map(link => {
                          const Icon = link.icon
                          const isActive = isCurrentPath(pathname, link.href)
                          return (
                            <m.li key={link.href} variants={mobileLinkVariant}>
                              <Link
                                href={link.href}
                                onClick={() => setMobileOpen(false)}
                                aria-current={isActive ? 'page' : undefined}
                                className={`group/m flex items-center gap-2 rounded-sm px-2.5 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                  isActive
                                    ? 'bg-accent-dim text-accent'
                                    : 'text-text-secondary hover:bg-panel hover:text-text-bright'
                                }`}
                              >
                                <Icon
                                  className={`h-3.5 w-3.5 shrink-0 ${
                                    isActive ? 'text-accent' : 'text-text-muted group-hover/m:text-accent'
                                  }`}
                                  aria-hidden="true"
                                />
                                <span className="truncate">{link.label}</span>
                              </Link>
                            </m.li>
                          )
                        })}
                      </m.ul>
                    </m.div>
                    )
                  })}

                  {/* Account card */}
                  <m.div
                    initial="hidden"
                    animate="show"
                    variants={staggerContainer(0.04, mobileGroups.length * 0.05)}
                    className={`rounded-sm border bg-surface/40 p-2 transition-colors ${
                      isAccountCardActive ? 'border-accent/40' : 'border-border'
                    }`}
                  >
                    <div className="mb-1.5 flex items-baseline justify-between px-1">
                      <p className="text-[10px] sm:text-xs uppercase tracking-widest text-accent font-semibold flex items-center gap-1.5">
                        account
                        {isAccountCardActive && (
                          <span
                            className="h-1 w-1 rounded-full bg-accent"
                            aria-label="Current section"
                          />
                        )}
                      </p>
                      <p className="text-[10px] text-text-tertiary tabular-nums">
                        {isConnected ? 'connected' : 'guest'}
                      </p>
                    </div>
                    <m.ul className="grid grid-cols-2 gap-1">
                      <m.li variants={mobileLinkVariant}>
                        <Link
                          href="/dashboard"
                          onClick={() => setMobileOpen(false)}
                          className="group/m flex items-center gap-2 rounded-sm px-2.5 py-2 text-xs text-text-secondary transition-colors hover:bg-panel hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <Key className="h-3.5 w-3.5 shrink-0 text-text-muted group-hover/m:text-accent" aria-hidden="true" />
                          <span className="truncate">dashboard</span>
                        </Link>
                      </m.li>
                      <m.li variants={mobileLinkVariant}>
                        <Link
                          href="/deposit"
                          onClick={() => setMobileOpen(false)}
                          className="group/m flex items-center gap-2 rounded-sm px-2.5 py-2 text-xs text-text-secondary transition-colors hover:bg-panel hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <Zap className="h-3.5 w-3.5 shrink-0 text-text-muted group-hover/m:text-accent" aria-hidden="true" />
                          <span className="truncate">deposit</span>
                        </Link>
                      </m.li>
                      <m.li variants={mobileLinkVariant}>
                        <Link
                          href="/settings"
                          onClick={() => setMobileOpen(false)}
                          className="group/m flex items-center gap-2 rounded-sm px-2.5 py-2 text-xs text-text-secondary transition-colors hover:bg-panel hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <Settings className="h-3.5 w-3.5 shrink-0 text-text-muted group-hover/m:text-accent" aria-hidden="true" />
                          <span className="truncate">settings</span>
                        </Link>
                      </m.li>
                      <m.li variants={mobileLinkVariant}>
                        <Link
                          href="/docs"
                          onClick={() => setMobileOpen(false)}
                          className="group/m flex items-center gap-2 rounded-sm px-2.5 py-2 text-xs text-text-secondary transition-colors hover:bg-panel hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 text-text-muted group-hover/m:text-accent" aria-hidden="true" />
                          <span className="truncate">api docs</span>
                        </Link>
                      </m.li>
                    </m.ul>
                  </m.div>
                </div>

                {/* Bottom: API + GitHub + keyboard hint */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-3 text-[11px] text-text-muted">
                  <ApiStatus />
                  <a
                    href="https://github.com/oma-ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    github ↗
                  </a>
                  <span className="hidden sm:inline-flex items-center gap-1 text-text-tertiary tabular-nums">
                    <CornerDownLeft className="h-3 w-3" aria-hidden="true" />
                    <span>esc to close</span>
                  </span>
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  )
}
