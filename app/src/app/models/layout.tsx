import type { Metadata } from 'next'
import './models.css'

export const metadata: Metadata = {
  title: 'Models',
  description: 'Browse 19+ AI models including GPT-4o, Claude Sonnet 4, Deepseek V4, Llama 3.3 and more. Compare pricing across Venice AI, AntSeed, and other providers.',
  keywords: ['AI models', 'GPT-4o', 'Claude', 'Llama', 'Deepseek', 'AI API', 'LLM pricing'],
  openGraph: {
    title: 'AI Models | OMA AI',
    description: 'Browse 19+ AI models with transparent pricing. Route inference across multiple providers with automatic failover.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'OMA AI Gateway' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Models | OMA AI',
    description: 'Browse 19+ AI models with transparent pricing.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'OMA AI Gateway' }],
  },
}

export default function ModelsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
