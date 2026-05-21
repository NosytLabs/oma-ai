'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useWallet } from '@/components/wallet-provider'
import { ConnectButton } from '@/components/connect-button'
import { Menu, X, LogOut, ChevronDown, Hexagon, Key } from 'lucide-react'

export function Navbar() {
  const {
    evmAddress,
    isConnected,
    disconnect,
  } = useWallet()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <nav className="group fixed top-0 left-0 right-0 z-50 border-b border-border bg-void/90 backdrop-blur-md transition-[box-shadow] duration-300 hover:shadow-[0_1px_20px_rgba(0,255,200,0.07)]">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-1 text-xl font-bold tracking-tight">
          <span className="text-cyan">OMA</span>
          <span className="text-text-dim text-base">.AI</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <NavLink href="/models">Models</NavLink>
          <NavLink href="/pricing">Pricing</NavLink>
          <NavLink href="/docs">Docs</NavLink>
          <NavLink href="/playground">Playground</NavLink>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {!isConnected && (
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 rounded-lg border border-cyan/40 bg-cyan/8 px-4 py-2 text-xs font-bold text-cyan transition-all duration-200 hover:border-cyan hover:bg-cyan hover:text-void hover:shadow-[0_0_20px_rgba(0,255,200,0.2)] min-h-[40px]"
            >
              <Key className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
              Get API Key
            </Link>
          )}
          {isConnected && evmAddress ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors hover:border-cyan/50"
              >
                <Hexagon className="h-4 w-4 text-blue-400" />
                <span className="mono text-text">
                  {`${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}`}
                </span>
                <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-400">
                  BASE
                </span>
                <ChevronDown className="h-3 w-3 text-text-dim" />
              </button>

              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-border bg-panel py-1 shadow-xl">
                    <div className="border-b border-border px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Hexagon className="h-3 w-3 text-blue-400" />
                        <p className="mono text-xs text-text-dim break-all">
                          {evmAddress}
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text transition-colors hover:bg-surface"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/deposit"
                      onClick={() => setDropdownOpen(false)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text transition-colors hover:bg-surface"
                    >
                      Deposit
                    </Link>
                    <Link
                      href="/stake"
                      onClick={() => setDropdownOpen(false)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text transition-colors hover:bg-surface"
                    >
                      Stake
                    </Link>
                    <div className="border-t border-border" />
                    <button
                      onClick={() => {
                        disconnect()
                        setDropdownOpen(false)
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red transition-colors hover:bg-surface"
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
          className="text-text-dim transition-colors hover:text-cyan md:hidden"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-void px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            <MobileNavLink href="/models" onClick={() => setMobileOpen(false)}>
              Models
            </MobileNavLink>
            <MobileNavLink href="/pricing" onClick={() => setMobileOpen(false)}>
              Pricing
            </MobileNavLink>
            <MobileNavLink href="/docs" onClick={() => setMobileOpen(false)}>
              Docs
            </MobileNavLink>
            <MobileNavLink href="/playground" onClick={() => setMobileOpen(false)}>
              Playground
            </MobileNavLink>
            <MobileNavLink href="/stake" onClick={() => setMobileOpen(false)}>
              Stake
            </MobileNavLink>

            {!isConnected && (
              <div className="mt-2">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-lg border border-cyan/40 bg-cyan/8 px-4 py-3 text-sm font-bold text-cyan transition-all hover:border-cyan hover:bg-cyan hover:text-void"
                >
                  <Key className="h-4 w-4" />
                  Get API Key
                </Link>
              </div>
            )}

            {isConnected && (
              <>
                <div className="my-2 border-t border-border" />
                <MobileNavLink href="/dashboard" onClick={() => setMobileOpen(false)}>
                  Dashboard
                </MobileNavLink>
                <MobileNavLink href="/deposit" onClick={() => setMobileOpen(false)}>
                  Deposit
                </MobileNavLink>
                <MobileNavLink href="/stake" onClick={() => setMobileOpen(false)}>
                  Stake
                </MobileNavLink>
              </>
            )}

            <div className="my-2 border-t border-border" />

            {isConnected && evmAddress ? (
              <button
                onClick={() => {
                  disconnect()
                  setMobileOpen(false)
                }}
                className="flex items-center gap-2 text-sm text-red"
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
      )}
    </nav>
  )
}

function NavLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-dim transition-colors hover:text-cyan hover:bg-surface"
    >
      {children}
    </Link>
  )
}

function MobileNavLink({
  href,
  children,
  onClick,
}: {
  href: string
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-dim transition-colors hover:text-cyan hover:bg-surface"
    >
      {children}
    </Link>
  )
}
