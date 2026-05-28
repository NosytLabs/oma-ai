import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'OpenRouter Alternative | OMA AI',
  description: 'OMA AI is a privacy-first, wallet-based alternative to OpenRouter. No account required. Pay with crypto.',
  keywords: ['OpenRouter alternative', 'AI API', 'privacy', 'crypto payments', 'no account'],
  openGraph: {
    title: 'OpenRouter Alternative | OMA AI',
    description: 'Privacy-first AI API. No account required. Pay with crypto.',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenRouter Alternative | OMA AI',
    description: 'Privacy-first AI API alternative.',
    images: ['/og-image.png'],
  },
}

export default function CompareLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
