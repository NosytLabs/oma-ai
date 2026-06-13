import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings | OMA AI",
  description:
    "Manage your OMA account — wallets, API keys, account number, and danger-zone actions.",
  robots: { index: false, follow: false },
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
