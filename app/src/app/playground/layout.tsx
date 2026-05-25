import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Playground | OMA AI',
  description: 'Test AI models in real-time with our interactive playground.',
}

export default function PlaygroundLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
