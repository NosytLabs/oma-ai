import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing | OMA AI',
  description: 'Transparent pricing. Pay per token with crypto.',
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
