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
  return (
    <ConnectWalletWrapper>
      <div className="min-h-[calc(100dvh-2.75rem)] bg-[var(--color-void)] text-[var(--color-text-secondary)] font-mono">
        {children}
      </div>
    </ConnectWalletWrapper>
  )
}
