import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk, Syne } from "next/font/google";
import { MotionProvider } from "@/components/motion-provider";
import { ConnectWalletWrapper } from "@/components/ConnectWalletWrapper";
import { ErrorBoundary } from "@/components/error-boundary";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { Providers } from "@/components/providers";
import { THEME_HEAD_SCRIPT, ThemeProvider } from "@/components/ThemeProvider";
import { ToastProviderClient } from "@/components/ui/ToastProviderClient";
import { MODEL_COUNT } from "@/lib/models-data";
import { OrganizationJsonLd, SoftwareApplicationJsonLd } from "@/components/json-ld";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
	subsets: ["latin"],
	variable: "--font-space-grotesk",
	display: "swap",
	preload: true,
	weight: ["400", "500", "600", "700"],
	fallback: ["system-ui", "sans-serif"],
});

const syne = Syne({
	subsets: ["latin"],
	variable: "--font-syne",
	display: "swap",
	preload: true,
	weight: ["500", "600", "700", "800"],
	fallback: ["system-ui", "sans-serif"],
});

const jetbrainsMono = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-jetbrains-mono",
	display: "swap",
	preload: false,
	weight: ["400", "500", "600"],
	fallback: ["ui-monospace", "SFMono-Regular", "monospace"],
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://oma-ai.com";

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#fafafa" },
		{ media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
	],
	width: "device-width",
	initialScale: 1,
	maximumScale: 5,
};

export const metadata: Metadata = {
	metadataBase: new URL(BASE_URL),
	title: {
		default: "OMA-AI — AI Compute for Builders",
		template: "%s | OMA-AI",
	},
	description: `Run any model, pay per request with USDC. ${MODEL_COUNT}+ AI models behind one OpenAI-compatible API. x402-native, no subscriptions, no monthly bills.`,
	keywords: [
		"AI",
		"inference",
		"LLM",
		"OpenAI",
		"Anthropic",
		"crypto",
		"USDC",
		"x402",
		"API",
		"developers",
		"image generation",
		"video generation",
	],
	authors: [{ name: "OMA AI" }],
	creator: "OMA AI",
	publisher: "OMA AI",
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-video-preview": -1,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
	},
	twitter: {
		card: "summary_large_image",
		title: "OMA-AI — AI Compute for Builders",
		description: `Run any model, pay per request with USDC. ${MODEL_COUNT}+ AI models behind one OpenAI-compatible API. x402-native.`,
		site: "@oma_ai",
		creator: "@oma_ai",
			},
	openGraph: {
		type: "website",
		locale: "en_US",
		url: BASE_URL,
		siteName: "OMA AI",
		title: "OMA-AI — AI Compute for Builders",
		description: `Run any model, pay per request with USDC. ${MODEL_COUNT}+ AI models behind one OpenAI-compatible API. x402-native, no subscriptions.`,
		images: [
			{
				url: "/og-image.png",
				width: 1200,
				height: 630,
				alt: "OMA AI — Open Model Access, one API for every model",
			},
		],
	},
	icons: {
		icon: "/favicon.svg",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={`${spaceGrotesk.variable} ${syne.variable} ${jetbrainsMono.variable}`}
		>
			<head>
				{/* Pre-hydration theme script — runs synchronously before first paint
            to set <html data-theme="..."> from localStorage. Prevents FOUC
            for light-theme users. See ThemeProvider.tsx. */}
				<script dangerouslySetInnerHTML={{ __html: THEME_HEAD_SCRIPT }} />
				<OrganizationJsonLd />
				<SoftwareApplicationJsonLd />
				<link rel="preconnect" href="https://eth.coinbase.com" />
				<link rel="preconnect" href="https://base-rpc.publicnode.com" />
				<link rel="preconnect" href="https://api.jup.ag" />
				<link rel="preconnect" href="https://verify.walletconnect.com" />
				<link rel="dns-prefetch" href="https://*.walletconnect.com" />
				<link rel="dns-prefetch" href="https://*.coinbase.com" />
				<link rel="canonical" href={BASE_URL} />
			</head>
			<body className="min-h-screen bg-void text-text font-sans antialiased">
				<a
					href="#main-content"
					className="sr-only focus:not-sr-only focus:fixed focus:top-14 focus:left-4 focus:z-[100] focus:bg-accent focus:text-void focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold focus:shadow-[0_0_20px_var(--color-accent-glow)]"
				>
					Skip to main content
				</a>
				<ThemeProvider>
					<ToastProviderClient>
						<MotionProvider>
							<Providers>
								<ConnectWalletWrapper>
									<Navbar />
								</ConnectWalletWrapper>
								<main
									id="main-content"
									className="pt-14 page-enter"
									tabIndex={-1}
								>
									<ErrorBoundary>{children}</ErrorBoundary>
								</main>
								<Footer />
							</Providers>
						</MotionProvider>
					</ToastProviderClient>
				</ThemeProvider>
			</body>
		</html>
	);
}
