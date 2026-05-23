import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Deposit Credits',
  description: 'Deposit funds to your OMA AI account. Supports USDC on Base and Solana, OMA token staking with 5% bonus, and 100+ cryptocurrencies via HoudiniSwap.',
  robots: {
    index: true,
    follow: true,
  },
}

export default function DepositLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}