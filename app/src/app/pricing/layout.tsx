import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing | OMA AI',
  description: 'Transparent AI API pricing. Pay per token with crypto. No subscriptions, no hidden fees. Access 50+ models from $0.01/M tokens.',
  keywords: ['AI pricing', 'token pricing', 'crypto payments', 'OpenAI compatible', 'pay per token'],
  openGraph: {
    title: 'AI API Pricing | OMA AI',
    description: 'Pay per token, no subscriptions. Access 50+ AI models from $0.01/M tokens. Crypto payments supported.',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI API Pricing | OMA AI',
    description: 'Transparent pay-per-token pricing. No subscriptions.',
    images: ['/og-image.png'],
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
