'use client'

import { useState, useRef, useEffect } from 'react'
import { useConnect, useDisconnect, useAccount } from 'wagmi'
import Image from 'next/image'
import { Wallet, LogOut, ChevronDown, Hexagon, Key } from 'lucide-react'
import { useWallet } from '@/components/wallet-provider'
import { AccountLoginModal } from '@/components/account-login-modal'

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function ConnectButton() {
  const { address, isConnected, isConnecting } = useAccount()
  const { connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { connectEvm } = useWallet()
  const [showAccountLogin, setShowAccountLogin] = useState(false)

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
          className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-400 transition-all hover:border-cyan-400/50 hover:bg-cyan-500/15"
          aria-expanded={open}
          aria-label="Wallet menu"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-mono">{truncateAddress(address)}</span>
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-zinc-800/80 bg-zinc-900/98 backdrop-blur-xl py-2 shadow-2xl shadow-black/50">
              <div className="border-b border-zinc-800/50 px-4 py-3">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Connected</p>
                <p className="font-mono text-sm text-cyan-400 break-all mt-1">{truncateAddress(address)}</p>
              </div>
              <button
                onClick={() => { disconnect(); setOpen(false) }}
                className="flex w-full items-center gap-2 px-4 py-3 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors"
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
        aria-label="Connect wallet"
        className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-2.5 text-sm font-semibold text-cyan-400 transition-all hover:border-cyan-400/50 hover:bg-cyan-500/15"
      >
        <Wallet className="h-4 w-4" />
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-zinc-800/80 bg-zinc-900/98 backdrop-blur-xl py-2 shadow-2xl shadow-black/50">
          <div className="border-b border-zinc-800/50 px-4 py-3">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Select Wallet
            </p>
          </div>
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => { connectEvm(connector.id); setOpen(false) }}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-zinc-800/50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/20">
                {connector.icon ? (
                  <Image src={connector.icon} alt={connector.name} width={20} height={20} className="h-5 w-5" />
                ) : (
                  <Hexagon className="h-4 w-4 text-blue-400" />
                )}
              </div>
              <div className="text-left">
                <div className="font-medium text-white">{connector.name}</div>
              </div>
            </button>
          ))}
          <div className="border-t border-zinc-800/50 mt-1 pt-1">
            <button
              onClick={() => { setOpen(false); setShowAccountLogin(true) }}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-zinc-800/50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/20">
                <Key className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="text-left">
                <div className="font-medium text-white">Account Number</div>
                <div className="text-xs text-zinc-500">Mullvad-style login</div>
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