import type { Metadata } from 'next'
import { ConnectWalletWrapper } from '@/components/ConnectWalletWrapper'

export const metadata: Metadata = {
  title: 'Deposit Credits',
  description: 'Deposit funds to your OMA AI account. Supports USDC on Base and Solana, and 100+ cryptocurrencies via HoudiniSwap.',
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
  return <ConnectWalletWrapper>{children}</ConnectWalletWrapper>
}