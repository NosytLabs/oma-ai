import type { Metadata } from 'next'
import { ConnectWalletWrapper } from '@/components/ConnectWalletWrapper'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Manage your API keys, view usage statistics, and deposit credits.',
  alternates: { canonical: '/dashboard' },
  openGraph: {
    title: 'Dashboard | OMA AI',
    description: 'Manage your API keys, view usage statistics, and deposit credits.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'OMA AI Gateway' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dashboard | OMA AI',
    description: 'Manage your API keys, view usage statistics, and deposit credits.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'OMA AI Gateway' }],
  },
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConnectWalletWrapper>
      <div className="min-h-[calc(100dvh-2.75rem)] bg-void text-text-secondary font-mono">
        {children}
      </div>
    </ConnectWalletWrapper>
  )
}
