import type { Metadata } from "next";
import { MODEL_COUNT } from "@/lib/models-data";

const MODELS_DESC = `${MODEL_COUNT}+ AI models · one API key · pay in USDC`;

export const metadata: Metadata = {
	title: "Sign in",
	description: `Sign in to OMA AI with your wallet (SIWE on Base) or a 16-digit anonymous account number. ${MODELS_DESC}. No email, no password, no KYC — crypto-native AI inference.`,
	alternates: { canonical: "/login" },
	robots: { index: false, follow: false },
};

export default function LoginLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
