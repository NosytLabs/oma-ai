'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useWallet } from '@/components/wallet-provider'
import { ConnectButton } from '@/components/connect-button'
import { Menu, X, ChevronDown, Key, Zap } from 'lucide-react'

const navLinks = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/models', label: 'Models' },
  { href: '/playground', label: 'Playground' },
  { href: '/docs', label: 'Docs' },
  { href: '/dashboard', label: 'Dashboard' },
]

function OmaLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = {
    sm: { circle: 28, icon: 5, text: 18 },
    md: { circle: 36, icon: 6, text: 22 },
    lg: { circle: 48, icon: 8, text: 28 },
  }
  const s = sizeMap[size]
 
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: s.circle, height: s.circle }}>
      <defs>
        <linearGradient id={`navGrad${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00ffc8"/>
          <stop offset="50%" stopColor="#00d4aa"/>
          <stop offset="100%" stopColor="#009984"/>
        </linearGradient>
        <linearGradient id={`accentGrad${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffb800"/>
          <stop offset="100%" stopColor="#ff8c00"/>
        </linearGradient>
        <filter id={`glow${size}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <circle cx="32" cy="32" r="28" fill="#09090b"/>
      <circle cx="32" cy="32" r="27" stroke={`url(#navGrad${size})`} strokeWidth="1" opacity="0.4"/>
      <circle cx="32" cy="32" r="22" stroke={`url(#navGrad${size})`} strokeWidth="0.5" opacity="0.2"/>
      <path d="M32 14 L38 24 L50 26 L42 36 L44 48 L32 42 L20 48 L22 36 L14 26 L26 24 Z" fill="none" stroke={`url(#accentGrad${size})`} strokeWidth="2" strokeLinejoin="round" filter={`url(#glow${size})`}/>
      <circle cx="32" cy="32" r="5" fill={`url(#navGrad${size})`} filter={`url(#glow${size})`}/>
      <circle cx="32" cy="32" r="2.5" fill="#09090b"/>
    </svg>
  )
}

export function Navbar() {
  const { evmAddress, isConnected, disconnect } = useWallet()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const shortAddress = evmAddress ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}` : ''

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled 
        ? 'bg-zinc-950/95 backdrop-blur-2xl border-b border-zinc-800/60 shadow-2xl shadow-black/30' 
        : 'bg-gradient-to-b from-zinc-950/80 to-transparent'
    }`}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <div className="flex items-center gap-10">
            <Link href="/" className="flex items-center gap-3 group">
              <OmaLogo size="md" />
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-cyan-400 group-hover:text-cyan-300 transition-colors">OMA</span>
                <span className="text-sm font-medium tracking-widest text-zinc-500">AI</span>
              </div>
            </Link>

            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2.5 text-sm font-medium text-zinc-400 hover:text-cyan-400 rounded-lg hover:bg-cyan-400/5 transition-all duration-200 relative group"
                >
                  {link.label}
                  <span className="absolute bottom-1 left-4 right-4 h-px bg-cyan-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-200" />
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com/oma-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-all"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </a>
           
            {isConnected ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 border border-cyan-500/30 rounded-xl hover:border-cyan-400/50 hover:bg-cyan-500/15 transition-all duration-200"
                >
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-sm font-medium text-zinc-200 font-mono">{shortAddress}</span>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-60 py-2 bg-zinc-900/98 backdrop-blur-xl border border-zinc-800/80 rounded-xl shadow-2xl shadow-black/50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-2 mb-2 border-b border-zinc-800/50">
                      <p className="text-xs text-zinc-500">Connected</p>
                      <p className="text-sm font-mono text-cyan-400">{shortAddress}</p>
                    </div>
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:text-cyan-400 hover:bg-cyan-400/5 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Key className="w-4 h-4" />
                      <span>API Keys</span>
                    </Link>
                    <Link
                      href="/deposit"
                      className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:text-cyan-400 hover:bg-cyan-400/5 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Zap className="w-4 h-4" />
                      <span>Add Credits</span>
                    </Link>
                    <hr className="my-2 border-zinc-800/50" />
                    <button
                      onClick={() => { disconnect(); setShowUserMenu(false) }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <span>Disconnect</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <ConnectButton />
            )}

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden pb-4 animate-in slide-in-from-top-2 duration-200">
            <div className="pt-4 pb-2 border-t border-zinc-800/50 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-base font-medium text-zinc-300 hover:text-cyan-400 hover:bg-cyan-400/5 rounded-lg transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex items-center gap-3 px-4 pt-4 mt-4 border-t border-zinc-800/50">
                <a
                  href="https://github.com/oma-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  GitHub
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}