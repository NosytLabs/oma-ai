'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { Wallet, Wifi, CreditCard, LogOut, ChevronDown, Loader2, Key, HelpCircle, ExternalLink } from 'lucide-react'
import { useEnsName } from 'wagmi'
import { useWallet } from '@/components/wallet-context'
import { api } from '@/lib/api'

const AccountLoginModal = dynamic(
  () => import('@/components/account-login-modal').then(mod => mod.AccountLoginModal),
  { ssr: false }
)

const POPULAR_IDS = ['injected', 'coinbaseWalletSDK', 'com.coinbase.wallet']

function getIcon(id: string) {
  if (id === 'injected') return <Wallet className="h-4 w-4" />
  if (id === 'walletConnect') return <Wifi className="h-4 w-4" />
  if (id.includes('coinbase')) return <CreditCard className="h-4 w-4" />
  return <Wallet className="h-4 w-4" />
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function ConnectorRow({
  connector,
  onConnect,
  isPending,
}: {
  connector: { id: string; name: string; icon?: string }
  onConnect: (id: string) => void
  isPending: boolean
}) {
  return (
    <button
      onClick={() => onConnect(connector.id)}
      disabled={isPending}
      className="group w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left transition-all hover:bg-surface disabled:opacity-50"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface">
        {connector.icon ? (
          <Image src={connector.icon} alt="" width={16} height={16} className="h-4 w-4" />
        ) : (
          getIcon(connector.id)
        )}
      </div>
      <span className="flex-1">{connector.name}</span>
      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-muted" />}
    </button>
  )
}

export function ImprovedConnectButton({ align = 'right' }: { align?: 'left' | 'right' }) {
  const {
    evmAddress: address,
    isConnected,
    isConnecting,
    availableConnectors,
    connectEvm,
    disconnect,
    evmChain,
  } = useWallet()

  const { data: ensName } = useEnsName({ address, query: { enabled: !!address } })

  const [open, setOpen] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [showAccountLogin, setShowAccountLogin] = useState(false)
  const [connectingId, setConnectingId] = useState<string | null>(null)
  // Pre-fetch the CSRF token so the AccountLoginModal opens race-free
  // (A-C1 fix: the user can press Enter before any in-modal async fetch).
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    api.auth.getCsrfToken()
      .then((res) => {
        if (!cancelled && res.token) setCsrfToken(res.token)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!isConnecting) setConnectingId(null)
  }, [isConnecting])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
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

  function handleConnect(id: string) {
    setConnectingId(id)
    connectEvm(id)
    setOpen(false)
  }

  const popular = availableConnectors.filter(c => POPULAR_IDS.includes(c.id))
  const more = availableConnectors.filter(c => !POPULAR_IDS.includes(c.id))

  const positionClass = align === 'left' ? 'left-0' : 'right-0'

  if (isConnected && address) {
    const displayName = ensName || truncate(address)
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="group flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-4 py-2 text-sm font-medium text-accent transition-all hover:border-accent/50 hover:bg-accent/10 cursor-pointer"
          aria-expanded={open}
          aria-controls="wallet-menu"
          aria-haspopup="menu"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="font-mono text-text">{displayName}</span>
          {evmChain && (
            <span className="hidden sm:inline text-[11px] text-text-muted">{evmChain.name}</span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <>
            <button className="fixed inset-0 z-40 cursor-default bg-overlay/40" onClick={() => setOpen(false)} aria-label="Close" />
            <div id="wallet-menu" role="menu" className={`absolute ${positionClass} z-50 mt-2 w-64 border border-border bg-panel shadow-xl shadow-overlay`}>
              <div className="border-b border-border px-4 py-3">
                <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Connected</p>
                <p className="mt-1 font-mono text-sm text-accent break-all">{ensName || address}</p>
                {evmChain && (
                  <p className="text-xs text-text-muted mt-1">{evmChain.name}</p>
                )}
              </div>
              <button
                role="menuitem"
                onClick={() => { disconnect(); setOpen(false) }}
                className="flex w-full items-center gap-2 px-4 py-3 text-sm text-red opacity-80 transition-colors hover:text-red hover:bg-red/10 cursor-pointer"
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
        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-5 py-2.5 text-sm font-semibold text-void transition-all duration-300 before:absolute before:inset-0 before:bg-accent hover:before:bg-accent-hover before:transition-colors before:duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <div className="absolute inset-0 rounded-full" style={{
          background: 'conic-gradient(var(--color-accent), var(--color-accent-hover), var(--color-accent-dim), var(--color-accent))',
          animation: 'spin 4s linear infinite',
          padding: '1.5px',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          opacity: 0.6,
        }} />
        <span className="relative z-10 flex items-center gap-2">
          {isConnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wallet className="h-4 w-4" />
          )}
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </span>
      </button>

      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default bg-overlay/40" onClick={() => setOpen(false)} aria-label="Close" />
          <div id="wallet-menu" role="menu" className={`absolute ${positionClass} z-50 mt-2 w-72 border border-border bg-panel shadow-xl shadow-overlay`}>
            <div className="border-b border-border px-4 py-3">
              <p className="text-[10px] font-mono font-medium uppercase tracking-widest text-text-muted">
                Connect a wallet
              </p>
            </div>

            <div className="p-2">
              {popular.length > 0 && (
                <div className="mb-2">
                  <p className="px-1 text-[11px] font-mono uppercase tracking-wider text-text-muted mb-1">Popular</p>
                  <div className="space-y-0.5">
                    {popular.map(c => (
                      <ConnectorRow
                        key={c.id}
                        connector={c}
                        onConnect={handleConnect}
                        isPending={connectingId === c.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {more.length > 0 && (
                <div className="mb-2">
                  <p className="px-1 text-[11px] font-mono uppercase tracking-wider text-text-muted mb-1">More</p>
                  <div className="space-y-0.5">
                    {more.map(c => (
                      <ConnectorRow
                        key={c.id}
                        connector={c}
                        onConnect={handleConnect}
                        isPending={connectingId === c.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              <button
                role="menuitem"
                onClick={() => { setOpen(false); setShowAccountLogin(true) }}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-surface cursor-pointer"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/30 bg-accent/10">
                  <Key className="h-4 w-4 text-accent" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-text">Account Number</div>
                  <div className="text-xs text-text-muted">Mullvad-style login</div>
                </div>
              </button>
            </div>

            <div className="border-t border-border p-3">
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="flex items-center gap-2 text-[11px] text-text-muted transition-colors hover:text-text cursor-pointer"
              >
                <HelpCircle className="h-3 w-3" />
                What is a wallet?
                <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${showInfo ? 'rotate-180' : ''}`} />
              </button>
              {showInfo && (
                <div className="mt-2 text-[11px] text-text-muted leading-relaxed space-y-1.5">
                  <p>
                    A wallet lets you interact with decentralized apps on blockchain networks. It holds your keys, not your funds.
                  </p>
                  <p>
                    New to crypto? We recommend using{' '}
                    <a
                      href="https://coinbase.com/wallet"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-accent hover:underline"
                    >
                      Coinbase Wallet <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    {' '}or MetaMask.
                  </p>
                  <button
                    onClick={() => setOpen(false)}
                    className="mt-1 inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    Create a wallet <ExternalLink className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {showAccountLogin && (
        <AccountLoginModal onClose={() => setShowAccountLogin(false)} initialCsrfToken={csrfToken} />
      )}
    </div>
  )
}