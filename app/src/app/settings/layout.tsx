// Auth-gated product surface — render at request time only.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Settings — account, theme & sessions",
	description:
		"Manage your OMA account — profile, theme, sessions, privacy export, and danger-zone actions.",
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
