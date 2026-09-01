import type { Metadata } from "next";

export const metadata: Metadata = {
	// Root layout's title template is "%s · OMA", so just supply the
	// page name — the suffix is added automatically. Hardcoding "· OMA"
	// here doubled the brand suffix ("Admin · OMA · OMA").
	title: "Admin",
	robots: { index: false, follow: false },
};

export default function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}