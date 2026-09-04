import { ArrowLeft, Home, Search } from "lucide-react";
import Link from "next/link";
import { NotFoundLogger } from "./_components/NotFoundLogger";
import { OmaLogo } from "@/components/ui/oma-logo";

// Next 15 still tries to statically prerender `/_not-found` even though
// not-found.tsx is a server component — the synthetic shell wraps client
// islands and crashes with `useState` null. Opt out.

/**
 * NotFound — branded 404 page.
 * Server component (no hooks in the static body) so it prerenders cleanly
 * under Next 15. Logging moved to a tiny client island.
 * Single CTA: return home.
 */
export default function NotFound() {
	return (
		<NotFoundLogger>
			<div className="min-h-[60dvh] flex flex-col items-center justify-center px-4 py-20">
				<div className="w-full max-w-md text-center flex flex-col items-center gap-7">
					<OmaLogo size="lg" className="mb-2 opacity-90" />
					{/* Large 404 with accent-tinted digits */}
					<div className="relative">
						<div
							className="font-geometric text-[7rem] sm:text-[9rem] leading-none tracking-tight text-text-bright"
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
						<p className="eyebrow text-text-muted">
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
						<Link href="/" className="btn-mono flex items-center gap-2">
							<Home className="h-4 w-4" aria-hidden="true" />
							Return home
						</Link>
						<Link href="/docs" className="btn-mono flex items-center gap-2">
							<Search className="h-4 w-4" aria-hidden="true" />
							Browse docs
						</Link>
					</div>

					<div className="mt-6 pt-6 border-t border-border-subtle w-full">
						<Link
							href="/docs"
							className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent transition-colors duration-200 ease-out"
						>
							<ArrowLeft className="h-4 w-4" aria-hidden="true" />
							<span>Or jump straight to the API docs</span>
						</Link>
					</div>
				</div>
			</div>
		</NotFoundLogger>
	);
}
