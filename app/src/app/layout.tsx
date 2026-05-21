import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import { WalletProvider } from '@/components/wallet-provider'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { ErrorBoundary } from '@/components/error-boundary'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

const BASE_URL = 'https://oma-ai.com'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'OMA AI -- Permissionless Inference Gateway',
    template: '%s | OMA AI',
  },
  description:
    'OpenAI-compatible API gateway. Pay with 100+ cryptocurrencies. No KYC, no accounts, no limits. Access GPT, Claude, Gemini, and more.',
  keywords: ['AI API', 'OpenAI compatible', 'cryptocurrency payments', 'no KYC', 'inference gateway', 'GPT', 'Claude', 'Venice AI', 'AntSeed'],
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
    title: 'OMA AI -- Permissionless Inference Gateway',
    description: 'OpenAI-compatible API. Pay with 100+ cryptocurrencies. No KYC, no accounts, no limits.',
    site: '@oma_ai',
    creator: '@oma_ai',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BASE_URL,
    siteName: 'OMA AI',
    title: 'OMA AI -- Permissionless Inference Gateway',
    description: 'OpenAI-compatible API. Pay with 100+ cryptocurrencies. No KYC, no accounts, no limits.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'OMA AI - Permissionless Inference Gateway',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} antialiased`}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-screen bg-void text-text">
        <WalletProvider>
          <Navbar />
          <main className="pt-18">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  )
}
