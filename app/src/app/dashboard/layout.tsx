import type { Metadata } from 'next'
import { ConnectWalletWrapper } from '@/components/ConnectWalletWrapper'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Manage your API keys, view usage statistics, and deposit credits.',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ConnectWalletWrapper>{children}</ConnectWalletWrapper>
}
