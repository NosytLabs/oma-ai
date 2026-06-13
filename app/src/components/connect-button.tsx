'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { Wallet, LogOut, ChevronDown, Hexagon, Key } from 'lucide-react'
import { useWallet } from '@/components/wallet-context'

const AccountLoginModal = dynamic(
  () => import('@/components/account-login-modal').then(mod => mod.AccountLoginModal),
  { ssr: false }
)

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function ConnectButtonInner() {
  const { evmAddress: address, isConnected, isConnecting, availableConnectors, connectEvm, disconnect } = useWallet()
  const [showAccountLogin, setShowAccountLogin] = useState(false)

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  if (isConnected && address) {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="group flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-full text-[var(--color-cyan)] border border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/5 hover:border-[var(--color-cyan)]/50 hover:bg-[var(--color-cyan)]/10 transition-all duration-200 cursor-pointer"
          aria-expanded={open}
          aria-controls="wallet-menu"
          aria-haspopup="menu"
          aria-label="Wallet menu"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-success)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-success)]"></span>
          </span>
          <span className="font-mono text-[var(--color-text)]">{truncateAddress(address)}</span>
          <ChevronDown className={`h-4 w-4 text-[var(--color-text-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <>
            <button className="fixed inset-0 z-40 bg-[var(--color-overlay)]/40 cursor-default" onClick={() => setOpen(false)} aria-label="Close menu" />
            <div id="wallet-menu" role="menu" className="absolute right-0 z-50 mt-2 w-56 border border-[var(--color-border)] bg-[var(--color-panel)] shadow-xl shadow-[var(--color-overlay)]">
              <div className="border-b border-[var(--color-border)] px-4 py-3">
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-mono">Connected</p>
                <p className="font-mono text-sm text-[var(--color-cyan)] break-all mt-1">{truncateAddress(address)}</p>
              </div>
              <button
                role="menuitem"
                onClick={() => { disconnect(); setOpen(false) }}
                className="flex w-full items-center gap-2 px-4 py-3 text-sm text-[var(--color-red)] opacity-80 hover:text-[var(--color-red)] hover:bg-[var(--color-red)]/10 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={isConnecting}
        aria-expanded={open}
        aria-controls="wallet-menu"
        aria-haspopup="menu"
        aria-label="Connect wallet"
        className="group flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full text-[var(--color-cyan)] border border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/5 hover:border-[var(--color-cyan)]/50 hover:bg-[var(--color-cyan)]/10 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Wallet className="h-4 w-4" />
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
      {open && (
        <div id="wallet-menu" role="menu" className="absolute right-0 z-50 mt-2 w-72 border border-[var(--color-border)] bg-[var(--color-panel)] shadow-xl shadow-[var(--color-overlay)]">
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-widest font-mono">
              Select Wallet
            </p>
          </div>
          {availableConnectors.map((connector) => (
            <button
              key={connector.id}
              role="menuitem"
              onClick={() => { connectEvm(connector.id); setOpen(false) }}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-[var(--color-surface)] cursor-pointer"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border-bright)] bg-[var(--color-surface)]">
                {connector.icon ? (
                  <Image src={connector.icon} alt={connector.name} width={20} height={20} className="h-5 w-5" />
                ) : (
                  <Hexagon className="h-4 w-4 text-[var(--color-accent)]" />
                )}
              </div>
              <div className="text-left">
                <div className="font-medium text-[var(--color-text)]">{connector.name}</div>
              </div>
            </button>
          ))}
          <div className="border-t border-[var(--color-border)] mt-1 pt-1">
            <button
              role="menuitem"
              onClick={() => { setOpen(false); setShowAccountLogin(true) }}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-[var(--color-surface)] cursor-pointer"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/10">
                <Key className="h-4 w-4 text-[var(--color-cyan)]" />
              </div>
              <div className="text-left">
                <div className="font-medium text-[var(--color-text)]">Account Number</div>
                <div className="text-xs text-[var(--color-text-muted)]">Mullvad-style login</div>
              </div>
            </button>
          </div>
        </div>
      )}
      {showAccountLogin && (
        <AccountLoginModal onClose={() => setShowAccountLogin(false)} />
      )}
    </div>
  )
}

export function ConnectButton() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  if (!ready) {
    return <div className="w-24 shrink-0" />
  }

  return <ConnectButtonInner />
}