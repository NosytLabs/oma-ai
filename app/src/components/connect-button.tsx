'use client'

import { useState, useRef, useEffect } from 'react'
import { useConnect, useDisconnect, useAccount } from 'wagmi'
import { Wallet, LogOut, ChevronDown, Hexagon } from 'lucide-react'

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function ConnectButton() {
  const { address, isConnected, isConnecting } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (isConnected && address) {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors hover:border-cyan/50"
        >
          <Hexagon className="h-4 w-4 text-blue-400" />
          <span className="mono text-text">
            {truncateAddress(address)}
          </span>
          <ChevronDown className="h-3 w-3 text-text-dim" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-border bg-panel py-1 shadow-xl">
              <div className="border-b border-border px-4 py-2">
                <p className="mono text-xs text-text-dim break-all">{address}</p>
              </div>
              <button
                onClick={() => { disconnect(); setOpen(false) }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red transition-colors hover:bg-surface"
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
        className="btn-secondary flex items-center gap-2 border-cyan/50 text-cyan hover:border-cyan hover:bg-cyan/5"
      >
        <Wallet className="h-4 w-4" />
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-border bg-panel py-1 shadow-xl">
          <div className="border-b border-border px-4 py-2">
            <p className="text-xs font-medium text-text-dim uppercase tracking-wider">
              Select Wallet
            </p>
          </div>
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => { connect({ connector }); setOpen(false) }}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-surface"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                {connector.icon ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={connector.icon} alt={connector.name} className="h-5 w-5" />
                ) : (
                  <Hexagon className="h-4 w-4 text-blue-400" />
                )}
              </div>
              <div className="text-left">
                <div className="font-medium text-text">{connector.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
