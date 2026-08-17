import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Geist, Space_Grotesk } from "next/font/google";
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
	// Not used on every page's first paint — don't preload, or the browser
	// warns about unused preloads on routes without display type.
	preload: false,
});

// Space Grotesk — geometric sans for sharper, spec-sheet type used on
// stat numerals, KPI blocks, and "OMA gateway" small caps sections
// where Instrument Serif would feel editorial instead of precise.
// Brand identity keeps Instrument Serif (italic) for hero emotional
// words; Space Grotesk is the precision counterpart.
const geometric = Space_Grotesk({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-geometric",
	display: "swap",
	preload: false,
});

const body = Geist({
	subsets: ["latin"],
	variable: "--font-body",
	display: "swap",
	// Some pages paint only display type in the first frame (e.g. /docs
	// hero). next/font still emits a preload link when `preload: true`,
	// producing "woff2 preloaded but not used" warnings on every route.
	// Body type is loaded on demand via the CSS variable — no measurable
	// paint cost, but the warning is silenced everywhere.
	preload: false,
});

// Note: we previously loaded Geist_Mono from Google Fonts as --font-mono,
// but next/font kept injecting a preload link even with preload: false,
// causing a "woff2 preloaded but not used" warning on routes without mono
// text. The system stack (ui-monospace, SF Mono, Menlo, monospace) defined
// in globals.css is more than good enough for the few mono labels. Drop the
// web font entirely — saves ~14 KB and silences the console warning.

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
	alternates: {
		canonical: "/",
	},
	title: {
		default: "OMA · Open Model Access — AI inference, paid by card or USDC",
		template: "%s · OMA",
	},
	description:
		"One gateway. Every model. No lock-in. OpenAI-compatible AI inference with wallet-based auth, card credits, USDC on Base, and x402 pay-per-request.",
	openGraph: {
		siteName: "OMA",
		title: "OMA · Open Model Access — AI inference, paid by card or USDC",
		description:
			"One gateway. Every model. No lock-in. OpenAI-compatible AI inference with wallet-based auth, card credits, USDC on Base, and x402 pay-per-request.",
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
	manifest: "/manifest.webmanifest",
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
			className={`${display.variable} ${body.variable} ${geometric.variable}`}
		>
			<head>
				<script dangerouslySetInnerHTML={{ __html: `(function(){try{var d=document.documentElement;d.style.backgroundColor='#07090a';d.style.colorScheme='dark';var t=localStorage.getItem('oma-theme');if(t==='emerald'||t==='amber'||t==='mono'||t==='synth'){if(t==='emerald'){d.removeAttribute('data-theme');}else{d.setAttribute('data-theme',t);}}}catch(e){}})();` }} />
				<OrganizationJsonLd />
				<SoftwareApplicationJsonLd />
				<link rel="preconnect" href="https://base-rpc.publicnode.com" />
			</head>
			<body className="flex min-h-dvh flex-col bg-void text-text font-sans antialiased">
				<a
					href="#main-content"
					className="sr-only focus:not-sr-only focus:fixed focus:top-14 focus:left-4 focus:z-[100] focus:bg-accent focus:text-void focus:px-4 focus:py-2 focus:rounded-[var(--radius-lg)] focus:font-semibold focus:shadow-[0_0_20px_var(--color-accent-glow)] focus:outline-none focus-visible:outline-accent"
				>
					Skip to main content
				</a>
				<ThemeProvider>
					<ToastProviderClient>
						<MotionProvider>
							<Providers>
								<div className="flex min-h-dvh flex-col">
									<Navbar />
									<main
										id="main-content"
										className="flex min-h-0 min-w-0 w-full flex-1 flex-col"
										tabIndex={-1}
									>
										<ErrorBoundary>{children}</ErrorBoundary>
									</main>
									<Footer />
								</div>
							</Providers>
						</MotionProvider>
					</ToastProviderClient>
				</ThemeProvider>
			</body>
		</html>
	);
}
