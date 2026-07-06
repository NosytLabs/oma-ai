"use client";

import { ArrowLeft, Home, Search } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { log } from "@/lib/logger";

/**
 * NotFound — branded 404 page.
 * Pure inline SVG illustration (no Lottie dep) keeps the page under
 * one round-trip and zero JS overhead. Single CTA: return home.
 */

export default function NotFound() {
	useEffect(() => {
		if (process.env.NODE_ENV === "production") {
			log.warn("[404] Page not found", { path: window.location.pathname });
		}
	}, []);

	return (
		<div className="min-h-[60dvh] flex flex-col items-center justify-center px-4 py-20">
			<div className="w-full max-w-md text-center flex flex-col items-center gap-7">
				{/* Large 404 with accent-tinted digits */}
				<div className="relative">
					<div
						className="display-headline text-[7rem] sm:text-[9rem] leading-none font-bold tracking-tight text-text-bright"
						aria-hidden="true"
					>
						4
						<span className="gradient-text-accent">0</span>
						4
					</div>
					<svg
						viewBox="0 0 200 200"
						className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-6 text-accent opacity-50"
						aria-hidden="true"
						fill="none"
						stroke="currentColor"
						strokeWidth={1}
					>
						<path d="M10 60 Q 50 90, 100 60 T 190 60" strokeLinecap="round" />
						<path d="M10 70 Q 50 100, 100 70 T 190 70" strokeLinecap="round" opacity="0.5" />
					</svg>
				</div>

				<div className="flex flex-col gap-3 mt-4">
					<p className="text-xs text-text-muted uppercase tracking-[0.18em] font-mono">
						{">"} route_not_found
					</p>
					<h1 className="section-headline text-text-bright">
						This route doesn&apos;t exist.
					</h1>
					<p className="text-text-secondary leading-relaxed">
						The endpoint you tried isn&apos;t in our inference network. Verify the
						URL, or head back to the homepage.
					</p>
				</div>

				<div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-2">
					<Button asChild leftIcon={<Home className="h-4 w-4" />}>
						<Link href="/">Return home</Link>
					</Button>
					<Button
						asChild
						variant="secondary"
						leftIcon={<Search className="h-4 w-4" />}
					>
						<Link href="/docs">Browse docs</Link>
					</Button>
				</div>

				<div className="mt-6 pt-6 border-t border-border-subtle w-full">
					<Link
						href="/"
						className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent transition-colors"
					>
						<ArrowLeft className="h-4 w-4" aria-hidden="true" />
						<span>Back to homepage</span>
					</Link>
				</div>
			</div>
		</div>
	);
}