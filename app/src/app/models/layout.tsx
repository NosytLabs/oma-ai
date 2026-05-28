import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Models | OMA AI',
  description: 'Browse 50+ AI models including GPT-4o, Claude Sonnet 4, Deepseek V4, Llama 3.3 and more. Compare pricing across Venice AI, AntSeed, and other providers.',
  keywords: ['AI models', 'GPT-4o', 'Claude', 'Llama', 'Deepseek', 'AI API', 'LLM pricing'],
  openGraph: {
    title: 'AI Models | OMA AI',
    description: 'Browse 50+ AI models with transparent pricing. Route inference across multiple providers with automatic failover.',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Models | OMA AI',
    description: 'Browse 50+ AI models with transparent pricing.',
    images: ['/og-image.png'],
  },
}

export default function ModelsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
