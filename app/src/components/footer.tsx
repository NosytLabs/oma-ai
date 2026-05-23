import Link from 'next/link'

const PRODUCT_LINKS = [
  { label: 'Models', href: '/models' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '/docs' },
  { label: 'Playground', href: '/playground' },
  { label: 'Dashboard', href: '/dashboard' },
]

const CRYPTO_LINKS = [
  { label: 'Deposit', href: '/deposit' },
  { label: 'Crypto Payments', href: '/crypto-payments' },
]

const LEGAL_LINKS = [
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
]

function OmaLogoSmall() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-8 w-8">
      <defs>
        <linearGradient id="footerLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00ffc8"/>
          <stop offset="50%" stopColor="#00d4aa"/>
          <stop offset="100%" stopColor="#009984"/>
        </linearGradient>
        <linearGradient id="footerAccentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffb800"/>
          <stop offset="100%" stopColor="#ff8c00"/>
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="#09090b" stroke="url(#footerLogoGrad)" strokeWidth="1"/>
      <circle cx="16" cy="16" r="9" fill="none" stroke="url(#footerLogoGrad)" strokeWidth="0.5" opacity="0.4"/>
      <path d="M16 7 L19 12 L25 13 L21 18 L22 24 L16 21 L10 24 L11 18 L7 13 L13 12 Z" fill="none" stroke="url(#footerAccentGrad)" strokeWidth="1" strokeLinejoin="round"/>
      <circle cx="16" cy="16" r="2.5" fill="url(#footerLogoGrad)"/>
    </svg>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-zinc-800/60 bg-zinc-950/50">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <OmaLogoSmall />
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold tracking-tight text-cyan-400 group-hover:text-cyan-300 transition-colors">OMA</span>
                <span className="text-xs font-medium tracking-widest text-zinc-500">AI</span>
              </div>
            </Link>
            <p className="mt-5 max-w-sm text-sm text-zinc-500 leading-relaxed">
              The AI inference gateway built for builders. Access 50+ models with crypto-native payments and instant global access. No credit card required.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                All systems operational
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-4">
              Product
            </h4>
            <ul className="space-y-3">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-4">
              Payments
            </h4>
            <ul className="space-y-3">
              {CRYPTO_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-4 mt-8">
              Legal
            </h4>
            <ul className="space-y-3">
              {LEGAL_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-4">
              Community
            </h4>
            <div className="space-y-4">
              <a
                href="https://github.com/oma-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors duration-200"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                GitHub
              </a>
              <a
                href="https://twitter.com/oma_ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors duration-200"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Twitter
              </a>
              <div className="pt-2">
                <span className="inline-flex items-center gap-2 text-xs text-zinc-600">
                  <span className="w-2 h-2 rounded-full bg-cyan-500/60" />
                  Built on Base
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-zinc-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-600">
            2026 OMA AI. Permissionless inference for everyone.
          </p>
          <p className="text-xs text-zinc-700">
            Powered by Vault-Tec development tools
          </p>
        </div>
      </div>
    </footer>
  )
}