import type { Metadata } from 'next'
import { ConnectWalletWrapper } from '@/components/ConnectWalletWrapper'

export const metadata: Metadata = {
  title: 'API Playground',
  description: 'Test AI models in real-time with our interactive API playground. Supports streaming, multiple models, and system prompts.',
  keywords: ['AI playground', 'API testing', 'chatbot', 'streaming', 'OpenAI compatible'],
  openGraph: {
    title: 'API Playground | OMA AI',
    description: 'Test AI models in real-time. Stream responses, try different models, and experiment with prompts.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'OMA AI Gateway' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'API Playground | OMA AI',
    description: 'Test AI models in real-time with our interactive playground.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'OMA AI Gateway' }],
  },
}

export default function PlaygroundLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ConnectWalletWrapper>{children}</ConnectWalletWrapper>
}
