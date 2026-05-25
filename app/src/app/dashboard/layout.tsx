import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard | OMA AI',
  description: 'Manage your API keys, view usage statistics, and deposit credits.',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
