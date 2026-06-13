import type { Metadata } from "next";

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Admin | OMA AI",
  description: "OMA admin console — users, usage, revenue, fees, and rate limits.",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
