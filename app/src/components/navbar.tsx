'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useWallet } from '@/components/wallet-provider'
import { ConnectButton } from '@/components/connect-button'
import { Menu, X, LogOut, ChevronDown, Hexagon, Key, ArrowRightLeft, Image as ImageIcon, Play } from 'lucide-react'

const OMA_LOGO_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" className="h-8 w-8">
    <title>OMA AI Gateway Icon</title>
    <desc>OMA icon with stylized AI brain circuit mark</desc>
    <g transform="translate(0, 0) scale(0.42)">
      <path d="M32 0 C56 0 76 16 76 38 C76 58 58 72 36 72 C18 72 0 58 0 38 C0 18 16 0 36 0" fill="none" stroke="#6366f1" stroke-width="5" stroke-linecap="round"/>
      <circle cx="18" cy="28" r="4" fill="#6366f1"/>
      <circle cx="12" cy="42" r="3" fill="#6366f1"/>
      <circle cx="22" cy="52" r="3.5" fill="#6366f1"/>
      <circle cx="54" cy="24" r="3.5" fill="#6366f1"/>
      <circle cx="60" cy="38" r="4" fill="#6366f1"/>
      <circle cx="52" cy="54" r="3" fill="#6366f1"/>
      <circle cx="36" cy="36" r="6" fill="#6366f1"/>
      <circle cx="36" cy="36" r="3" fill="#fafafa"/>
      <path d="M18 28 L30 34 M22 52 L30 40 M54 24 L42 32 M52 54 L42 40 M36 30 L36 42 M30 36 L42 36" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
      <circle cx="62" cy="18" r="4" fill="#f43f5e"/>
    </g>
  </svg>
)

export function Navbar() {
  const {
    evmAddress,
    isConnected,
    disconnect,
  } = useWallet()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const navLinks = [
    { href: '/llms', label: 'Models' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/image-generation', label: 'Images', icon: ImageIcon },
    { href: '/video-generation', label: 'Video', icon: Play },
    { href: '/docs', label: 'Docs' },
    { href: '/playground', label: 'Playground' },
    { href: '/swap', label: 'Swap', icon: ArrowRightLeft },
    { href: '/stake', label: 'Stake' },
  ]

  const walletDropdownLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/deposit', label: 'Deposit' },
    { href: '/stake', label: 'Stake' },
  ]

  return (
    <nav className="group fixed top-0 left-0 right-0 z-50 border-b border-border bg-void/90 backdrop-blur-md transition-all duration-300 hover:shadow-soft">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 transition-transform duration-200 hover:scale-105">
          {OMA_LOGO_SVG}
          <span className="text-xl font-bold tracking-tight">
            <span className="text-accent">OMA</span>
            <span className="text-text-secondary text-base">.AI</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <NavLink key={link.href} href={link.href} icon={link.icon}>
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {!isConnected && (
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-4 py-2 text-xs font-bold text-accent transition-all duration-200 hover:border-accent hover:bg-accent hover:text-white hover:shadow-glow min-h-[40px]"
            >
              <Key className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
              Get API Key
            </Link>
          )}
          {isConnected && evmAddress ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm transition-all duration-200 hover:border-accent/50 hover:shadow-soft"
              >
                <Hexagon className="h-4 w-4 text-accent" />
                <span className="font-mono text-text">
                  {`${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}`}
                </span>
                <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">
                  BASE
                </span>
                <ChevronDown className={`h-3 w-3 text-text-secondary transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border bg-panel py-1 shadow-floating animate-fade-in">
                    <div className="border-b border-border px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Hexagon className="h-3 w-3 text-accent" />
                        <p className="font-mono text-xs text-text-secondary break-all">
                          {evmAddress}
                        </p>
                      </div>
                    </div>
                    {walletDropdownLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setDropdownOpen(false)}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text transition-colors duration-150 hover:bg-surface"
                      >
                        {link.label}
                      </Link>
                    ))}
                    <div className="border-t border-border" />
                    <button
                      onClick={() => {
                        disconnect()
                        setDropdownOpen(false)
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-secondary transition-colors duration-150 hover:bg-surface"
                    >
                      <LogOut className="h-4 w-4" />
                      Disconnect
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <ConnectButton />
          )}
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-text-secondary transition-all duration-200 hover:text-accent md:hidden"
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ease-out md:hidden ${
          mobileOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="border-t border-border bg-void px-4 py-4">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <MobileNavLink
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                icon={link.icon}
              >
                {link.label}
              </MobileNavLink>
            ))}

            {!isConnected && (
              <div className="mt-3 pt-3 border-t border-border">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-5 py-3 text-sm font-bold text-accent transition-all duration-200 hover:border-accent hover:bg-accent hover:text-white"
                >
                  <Key className="h-4 w-4" />
                  Get API Key
                </Link>
              </div>
            )}

            {isConnected && (
              <>
                <div className="my-3 border-t border-border" />
                {walletDropdownLinks.map((link) => (
                  <MobileNavLink
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </MobileNavLink>
                ))}
              </>
            )}

            <div className="my-3 border-t border-border" />

            {isConnected && evmAddress ? (
              <button
                onClick={() => {
                  disconnect()
                  setMobileOpen(false)
                }}
                className="flex items-center gap-2 text-sm text-secondary transition-colors duration-150 hover:text-accent"
              >
                <LogOut className="h-4 w-4" />
                Disconnect {`${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}`}
              </button>
            ) : (
              <div onClick={() => setMobileOpen(false)}>
                <ConnectButton />
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

function NavLink({
  href,
  icon: Icon,
  children,
}: {
  href: string
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-text-secondary transition-all duration-200 hover:text-accent hover:bg-surface hover:scale-105"
    >
      {Icon && <Icon className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" />}
      <span>{children}</span>
    </Link>
  )
}

function MobileNavLink({
  href,
  icon: Icon,
  children,
  onClick,
}: {
  href: string
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-text-secondary transition-all duration-200 hover:text-accent hover:bg-surface"
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      <span>{children}</span>
    </Link>
  )
}