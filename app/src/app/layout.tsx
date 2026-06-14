import type { Metadata, Viewport } from 'next'
import { Syne, Inter, JetBrains_Mono } from 'next/font/google'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { ErrorBoundary } from '@/components/error-boundary'
import { ToastProvider } from '@/components/ui/Toast'
import { MotionProvider } from '@/components/motion-provider'
import { ThemeProvider, THEME_HEAD_SCRIPT } from '@/components/ThemeProvider'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'sans-serif'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'sans-serif'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  preload: true,
  fallback: ['Consolas', 'Monaco', 'monospace'],
})

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://oma-ai.com'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'OMA AI - One Man Army // Open Model Access',
    template: '%s | OMA AI',
  },
  description:
    'Permissionless AI inference gateway. Access 91+ models with crypto payments. No sign-up required. Route inference across multiple providers with automatic failover.',
  keywords: ['AI', 'inference', 'LLM', 'OpenAI', 'Anthropic', 'crypto', 'payments', 'API', 'developers'],
  authors: [{ name: 'OMA AI' }],
  creator: 'OMA AI',
  publisher: 'OMA AI',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OMA AI - One Man Army // Open Model Access',
    description: 'Permissionless AI inference gateway. Access 91+ models with crypto payments. No sign-up required.',
    site: '@oma_ai',
    creator: '@oma_ai',
    images: ['/og-image.png'],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://oma-ai.com',
    siteName: 'OMA AI',
    title: 'OMA AI - One Man Army // Open Model Access',
    description: 'Permissionless AI inference gateway. Access 91+ models with crypto payments. No sign-up required. Route inference across multiple providers with automatic failover.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'OMA AI - One Man Army // Open Model Access',
      },
    ],
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Pre-hydration theme script — runs synchronously before first paint
            to set <html data-theme="..."> from localStorage. Prevents FOUC
            for light-theme users. See ThemeProvider.tsx. */}
        <script
          dangerouslySetInnerHTML={{ __html: THEME_HEAD_SCRIPT }}
        />
        <link rel="preconnect" href="https://eth.coinbase.com" />
        <link rel="preconnect" href="https://base-rpc.publicnode.com" />
        <link rel="preconnect" href="https://api.jup.ag" />
        <link rel="preconnect" href="https://verify.walletconnect.com" />
        <link rel="dns-prefetch" href="https://*.walletconnect.com" />
        <link rel="dns-prefetch" href="https://*.coinbase.com" />
      </head>
      <body className="min-h-screen bg-[var(--color-void)] text-[var(--color-text)] font-sans antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-20 focus:left-4 focus:z-[100] focus:bg-[var(--color-green)] focus:text-[var(--color-void)] focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <ToastProvider>
            <MotionProvider>
              <Navbar />
              <main id="main-content" className="pt-16" tabIndex={-1} role="main">
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
              <Footer />
            </MotionProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}