import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Login",
	description:
		"Sign in to OMA AI with your wallet or account number for permissionless AI inference.",
	alternates: { canonical: "/login" },
	robots: { index: false, follow: false },
	openGraph: {
		title: "Login | OMA AI",
		description:
			"Sign in to OMA AI with your wallet or account number for permissionless AI inference.",
		url: "https://oma-ai.com/login",
		images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Login | OMA AI",
		description:
			"Sign in to OMA AI with your wallet or account number for permissionless AI inference.",
		images: ["/opengraph-image"],
	},
};

export default function LoginLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
