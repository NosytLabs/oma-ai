import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Geist, Geist_Mono } from "next/font/google";
import { BRAND_COLORS } from "@/lib/brand";
import { MotionProvider } from "@/lib/animation/MotionProvider";
import { ErrorBoundary } from "@/components/error-boundary";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProviderClient } from "@/components/ui/ToastProviderClient";
import { OrganizationJsonLd, SoftwareApplicationJsonLd } from "@/components/json-ld";
import "./globals.css";

const display = Instrument_Serif({
	subsets: ["latin"],
	weight: "400",
	style: ["normal", "italic"],
	variable: "--font-display",
	display: "swap",
});

const body = Geist({
	subsets: ["latin"],
	variable: "--font-body",
	display: "swap",
});

const mono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
	display: "swap",
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://oma-ai.com";

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: dark)", color: BRAND_COLORS.void },
		{ media: "(prefers-color-scheme: light)", color: BRAND_COLORS.void },
	],
	colorScheme: "dark",
	width: "device-width",
	initialScale: 1,
};

export const metadata: Metadata = {
	metadataBase: new URL(BASE_URL),
	title: {
		default: "OMA · Open Model Access — AI inference paid in USDC",
		template: "%s · OMA",
	},
	description:
		"One gateway. Every model. No lock-in. OpenAI-compatible AI inference with wallet-based auth and USDC pay-per-request on Base.",
	openGraph: {
		siteName: "OMA",
		title: "OMA · Open Model Access — AI inference paid in USDC",
		description:
			"One gateway. Every model. No lock-in. OpenAI-compatible AI inference with wallet-based auth and USDC pay-per-request on Base.",
		type: "website",
		images: [
			{
				url: "/og-image.webp",
				width: 1280,
				height: 720,
				alt: "OMA — One gateway. Every model.",
			},
		],
	},
	// No title/description here on purpose: pages that don't define their own
	// twitter block would otherwise inherit the homepage copy wholesale.
	// Twitter falls back to each page's og:title/og:description when absent.
	twitter: {
		card: "summary_large_image",
		images: ["/og-image.webp"],
	},
	icons: {
		icon: [
			{ url: "/favicon.svg", type: "image/svg+xml" },
			{ url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
			{ url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
		],
		apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
	},
	applicationName: "OMA AI",
	keywords: [
		"AI API",
		"OpenAI compatible",
		"inference gateway",
		"USDC",
		"x402",
		"Venice AI",
		"Open Model Access",
	],
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
			className={`${display.variable} ${body.variable} ${mono.variable}`}
		>
			<head>
				<script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('oma-theme');if(t==='emerald'||t==='amber'||t==='mono'||t==='synth'){if(t==='emerald'){document.documentElement.removeAttribute('data-theme');}else{document.documentElement.setAttribute('data-theme',t);}}document.documentElement.style.colorScheme='dark';}catch(e){}})();` }} />
				<OrganizationJsonLd />
				<SoftwareApplicationJsonLd />
				<link rel="preconnect" href="https://base-rpc.publicnode.com" />
			</head>
			<body className="min-h-screen bg-void text-text font-sans antialiased">
				<a
					href="#main-content"
					className="sr-only focus:not-sr-only focus:fixed focus:top-14 focus:left-4 focus:z-[100] focus:bg-accent focus:text-void focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold focus:shadow-[0_0_20px_var(--color-accent-glow)] focus:outline-none focus-visible:outline-accent"
				>
					Skip to main content
				</a>
				<ThemeProvider>
					<ToastProviderClient>
						<MotionProvider>
							<Providers>
								<Navbar />
								<main
									id="main-content"
									className="min-w-0 max-w-[100vw] overflow-x-clip pt-14 page-enter"
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
