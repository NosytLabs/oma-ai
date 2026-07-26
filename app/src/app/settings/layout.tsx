// Auth-gated product surface — render at request time only.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Settings — account, wallets & sessions",
	description:
		"Manage your OMA account — wallets, API keys, account number, and danger-zone actions.",
	alternates: { canonical: "/settings" },
	robots: { index: false, follow: false },
};

export default function SettingsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
