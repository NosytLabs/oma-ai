import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Playground | OMA AI',
  description: 'Test AI models in real-time with our interactive API playground. Supports streaming, multiple models, and system prompts.',
  keywords: ['AI playground', 'API testing', 'chatbot', 'streaming', 'OpenAI compatible'],
  openGraph: {
    title: 'API Playground | OMA AI',
    description: 'Test AI models in real-time. Stream responses, try different models, and experiment with prompts.',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'API Playground | OMA AI',
    description: 'Test AI models in real-time with our interactive playground.',
    images: ['/og-image.png'],
  },
}

export default function PlaygroundLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
