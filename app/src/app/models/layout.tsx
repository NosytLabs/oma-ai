import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Models | OMA AI',
  description: 'Browse 50+ AI models including GPT-4, Claude, Llama, and more.',
}

export default function ModelsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
