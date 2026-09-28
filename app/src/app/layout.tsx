import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Geist, Space_Grotesk } from "next/font/google";
import { BRAND_COLORS } from "@/lib/brand";
import SITE_URL from "@/lib/site";
import { ErrorBoundary } from "@/components/error-boundary";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProviderClient } from "@/components/ui/ToastProviderClient";
import { OrganizationJsonLd, SoftwareApplicationJsonLd, WebSiteJsonLd } from "@/components/json-ld";
import { MaintenanceBanner } from "@/components/shared/MaintenanceBanner";
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

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: dark)", color: BRAND_COLORS.void },
		{ media: "(prefers-color-scheme: light)", color: BRAND_COLORS.void },
	],
	colorScheme: "dark",
	width: "device-width",
	initialScale: 1,
	// Activate the safe-area (env(safe-area-inset-*)) padding defined in
	// globals.css on notched iOS / gesture nav. Without `cover` the browser
	// letterboxes the viewport and those insets are inert.
	viewportFit: "cover",
};

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	alternates: {
		canonical: "/",
	},
	title: {
		default: "OMA · Open Model Access — AI inference, USDC on Base",
		template: "%s · OMA",
	},
	description:
		"One gateway. Every model. No lock-in. OpenAI-compatible AI inference with wallet-based auth, USDC on Base, optional card checkout, and x402 settlement.",
	openGraph: {
		locale: "en_US",
		siteName: "OMA",
		title: "OMA · Open Model Access — AI inference, USDC on Base",
		description:
			"One gateway. Every model. No lock-in. OpenAI-compatible AI inference with wallet-based auth, USDC on Base, optional card checkout, and x402 settlement.",
		type: "website",
		url: SITE_URL,
		images: [
			{
				url: "/og-image.png?v=20260928",
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
		images: ["/og-image.png?v=20260928"],
	},
	icons: {
		icon: [
			{ url: "/favicon.svg?v=20260928", type: "image/svg+xml" },
			{ url: "/favicon-32x32.png?v=20260928", sizes: "32x32", type: "image/png" },
			{ url: "/favicon-16x16.png?v=20260928", sizes: "16x16", type: "image/png" },
		],
		apple: [{ url: "/apple-touch-icon.png?v=20260928", sizes: "180x180", type: "image/png" }],
	},
	manifest: "/manifest.webmanifest",
	applicationName: "OMA AI",
	verification: {
		google: "ugK-2CdwnQDrVaB5ew7ZmEAIjW6POklReEkwqJQBMVk",
	},
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
				<WebSiteJsonLd />
				<SoftwareApplicationJsonLd />
				<link rel="preconnect" href="https://base-rpc.publicnode.com" />
			</head>
			<body className="flex min-h-dvh flex-col bg-void text-text font-sans antialiased overflow-x-hidden">
				<GoogleAnalytics />
				<a
					href="#main-content"
					className="sr-only focus:not-sr-only focus:fixed focus:top-14 focus:left-4 focus:z-[100] focus:bg-accent focus:text-void focus:px-4 focus:py-2 focus:rounded-[var(--radius-lg)] focus:font-semibold focus:shadow-[0_0_20px_var(--color-accent-glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void"
				>
					Skip to main content
				</a>
				<ThemeProvider>
					<ToastProviderClient>
						<Providers>
							<div className="flex min-h-dvh flex-col">
								<MaintenanceBanner />
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
					</ToastProviderClient>
				</ThemeProvider>
			</body>
		</html>
	);
}
