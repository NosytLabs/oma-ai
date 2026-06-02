'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useWallet } from '@/components/wallet-context'
import { OmaLogo } from '@/components/ui/oma-logo'
import { Menu, X, ChevronDown, Key, Zap } from 'lucide-react'
import { ApiStatus } from './api-status'

const ConnectButton = dynamic(() => import('@/components/connect-button').then(m => ({ default: m.ConnectButton })), { ssr: false })

const navLinks = [
  { href: '/models', label: 'Models' },
  { href: '/playground', label: 'Playground' },
  { href: '/docs', label: 'Docs' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/pricing', label: 'Pricing' },
]

export function Navbar() {
  const { evmAddress, isConnected, disconnect } = useWallet()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const pathname = usePathname()

  const shortAddress = evmAddress ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}` : ''

  return (
    <header className="sticky top-0 left-0 right-0 z-50 bg-[var(--color-void)]/80 backdrop-blur-md border-b border-[var(--color-border)]/80 font-mono">
      <nav aria-label="Main navigation" className="w-full px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-sm">
              <OmaLogo size="sm" />
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold tracking-tight text-[var(--color-text-bright)] group-hover:text-[var(--color-accent)] transition-colors duration-150">OMA</span>
                <span className="text-xs text-[var(--color-text-muted)]">SYS</span>
              </div>
            </Link>

            <div className="hidden lg:flex items-center gap-5 text-xs">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:text-[var(--color-accent)] active:translate-y-px transition-all duration-150 rounded-sm py-1 px-2 -mx-2 ${
                      isActive
                        ? 'text-[var(--color-accent)] bg-[var(--color-accent-dim)] border-b border-[var(--color-accent)]'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-dim)]'
                    }`}
                  >
                    [{link.label.toLowerCase()}]
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
            <a
              href="https://github.com/oma-ai"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository"
              className="hidden md:flex items-center justify-center w-8 h-8 rounded-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-bright)] hover:bg-[var(--color-border)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-95 transition-all duration-150"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </a>
            
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-px h-4 bg-[var(--color-border)]" />
              <ApiStatus />
            </div>

            {isConnected ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-sm hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:translate-y-px transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
                  aria-label="User menu"
                  aria-expanded={showUserMenu}
                  aria-haspopup="true"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-accent)]"></span>
                  </span>
                  <span className="text-xs text-[var(--color-text)]">{shortAddress}</span>
                  <ChevronDown className={`w-3 h-3 text-[var(--color-text-muted)] transition-transform duration-150 ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 py-1 bg-[var(--color-void)] border border-[var(--color-border)] rounded-sm shadow-xl shadow-black/60 animate-in fade-in slide-in-from-top-1 duration-150 z-[60]">
                    <div className="px-3 py-2 border-b border-[var(--color-border)]/80 mb-1">
                      <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Active Session</p>
                      <p className="text-xs text-[var(--color-accent)] mt-1">{shortAddress}</p>
                    </div>
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-bright)] hover:bg-[var(--color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)] focus-visible:bg-[var(--color-surface)] transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Key className="w-3 h-3" />
                      <span>API Keys</span>
                    </Link>
                    <Link
                      href="/deposit"
                      className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-bright)] hover:bg-[var(--color-surface)] focus-visible:outline-none focus-visible:bg-[var(--color-surface)] transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Zap className="w-3 h-3" />
                      <span>Add Credits</span>
                    </Link>
                    <div className="h-px bg-[var(--color-border)]/80 my-1" />
                    <button
                      onClick={() => { disconnect(); setShowUserMenu(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-error)]/80 hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)] focus-visible:bg-[var(--color-error)]/10 transition-colors text-left"
                    >
                      <span>Terminate Session</span>
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
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-bright)] hover:bg-[var(--color-surface-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-95 transition-colors"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div id="mobile-menu" className="lg:hidden border-t border-[var(--color-border)]/80 py-4 animate-in slide-in-from-top-1 duration-150 z-40">
            <ul className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`block px-3 py-2 text-sm rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)] transition-colors ${
                        isActive
                          ? 'text-[var(--color-accent)] bg-[var(--color-accent-dim)] border-l-2 border-[var(--color-accent)]'
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface)]'
                      }`}
                    >
                      &gt; {link.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </nav>
    </header>
  )
}