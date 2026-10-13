"use client";

import { ArrowRight, Menu, Terminal, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { BreadcrumbListJsonLd } from "@/components/json-ld";
import { MODEL_COUNT } from "@/lib/models-data";
import { useDialog } from "@/lib/use-dialog";
import { DocsSearch } from "./_components/DocsSearch";
import { NAV_ITEMS } from "./_lib/nav-data";
import { useInitialDocAnchor } from "./_lib/use-initial-doc-anchor";

import { AuthenticationSection } from "./sections/authentication";
import { AvailableModelsSection } from "./sections/available-models";
import { EndpointsSection } from "./sections/endpoints";
import { ErrorsSection } from "./sections/errors";
import { IntegrationsSection } from "./sections/integrations";
import { PricingSection } from "./sections/pricing";
import { ProviderRoutingSection } from "./sections/provider-routing";
import { QuickStartSection } from "./sections/quickstart";
import { RateLimitsSection } from "./sections/rate-limits";
import { SDKsSection } from "./sections/sdks";
import { StreamingSection } from "./sections/streaming";
import { X402Section } from "./sections/x402";

// Matches SectionHeading's scroll-mt-24 clearance below the fixed navigation.
const DOCS_SECTION_SCROLL_OFFSET_PX = 96;

/* ==================== SIDEBAR ==================== */

function Sidebar({ activeId }: { activeId: string }) {
	const [mobileOpen, setMobileOpen] = useState(false);
	const mobileNavId = useId();
	const [isMobile, setIsMobile] = useState(false);
	const { panelRef } = useDialog({
		open: mobileOpen && isMobile,
		onClose: () => setMobileOpen(false),
	});
	useEffect(() => {
		const m = window.matchMedia("(max-width: 1023px)");
		const u = () => setIsMobile(m.matches);
		u();
		m.addEventListener("change", u);
		return () => m.removeEventListener("change", u);
	}, []);
	const drawerHidden = isMobile && !mobileOpen;

	return (
		<>
			{/* bottom-24, not bottom-6: the toast stack is `fixed bottom-3`
			    (mobile) / `bottom-4` (sm+) at z-100 — the same z-index as this
			    button — so at bottom-6 the two boxes sat on top of each other
			    on every viewport below lg. Lifting the button clears the stack. */}
			<button
				type="button"
				onClick={() => setMobileOpen(!mobileOpen)}
				className="fixed bottom-24 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-void shadow-[0_0_20px_var(--color-accent-glow)] lg:hidden active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void"
				aria-label={
					mobileOpen ? "Close navigation menu" : "Open navigation menu"
				}
				aria-expanded={mobileOpen}
				aria-controls={mobileNavId}
			>
				{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
			</button>

			{mobileOpen && (
				<button
					type="button"
					className="fixed inset-0 z-40 bg-void/80 backdrop-blur-sm lg:hidden cursor-default active:scale-[0.97]"
					onClick={() => setMobileOpen(false)}
					aria-label="Close navigation menu"
				/>
			)}

			<aside
				ref={panelRef}
				id={mobileNavId}
				aria-label="Documentation navigation"
				aria-hidden={drawerHidden}
				inert={drawerHidden}
				className={`fixed left-0 top-14 z-[60] h-[calc(100dvh-3.5rem)] w-72 overflow-y-auto border-r border-border bg-surface transition-transform duration-200 ease-out lg:translate-x-0 ${
					mobileOpen ? "translate-x-0" : "-translate-x-full"
				}`}
			>
				<div className="p-4">
					<div className="mb-4 rounded-[var(--radius-xl)] bg-accent/10 p-3 border border-accent/20">
						<div className="flex items-center gap-2">
							<Terminal className="h-4 w-4 text-accent" />
							<span className="text-sm font-semibold text-accent">OMA API</span>
						</div>
						<p className="mt-1 text-xs text-text-muted">OpenAI-compatible</p>
					</div>

					<nav className="space-y-1" aria-label="Documentation navigation">
						{NAV_ITEMS.map((item) => {
							const Icon = item.icon;
							const isActive = activeId === item.id;
							return (
								<a
									key={item.id}
									href={`#${item.id}`}
									onClick={() => setMobileOpen(false)}
									className={`relative flex items-center gap-3 rounded-[var(--radius-lg)] px-3 py-3 min-h-[48px] text-sm transition-[background-color,color] ${
										isActive
											? "bg-accent/15 text-accent border border-accent/40 font-medium"
											: "text-text-muted hover:bg-surface hover:text-text border border-transparent"
									}`}
									aria-current={isActive ? "page" : undefined}
								>
									{isActive && (
										<span
											aria-hidden="true"
											className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r bg-accent"
										/>
									)}
									<Icon className="h-4 w-4" />
									{item.label}
								</a>
							);
						})}
					</nav>
				</div>
			</aside>
		</>
	);
}

/* ==================== CONTENT ==================== */

export function DocsContent() {
	const [activeId, setActiveId] = useState("quickstart");
	useInitialDocAnchor();

	useEffect(() => {
		let frame: number | undefined;
		const headings = NAV_ITEMS.map((item) => document.getElementById(item.id))
			.filter((heading): heading is HTMLElement => heading !== null);
		function updateSection() {
			frame = undefined;
			// Bookmarks and large scroll jumps can skip a heading's intersection
			// band. Keep its section selected until the next heading is reached.
			let current = NAV_ITEMS[0].id;
			const readingLine = Math.max(DOCS_SECTION_SCROLL_OFFSET_PX, window.innerHeight * 0.2);
			for (const heading of headings) {
				if (heading.getBoundingClientRect().top <= readingLine) {
					current = heading.id;
				}
			}
			setActiveId(current);
		}
		function scheduleUpdate() {
			if (frame === undefined) frame = requestAnimationFrame(updateSection);
		}
		scheduleUpdate();
		window.addEventListener("scroll", scheduleUpdate, { passive: true });
		window.addEventListener("resize", scheduleUpdate);
		return () => {
			if (frame !== undefined) cancelAnimationFrame(frame);
			window.removeEventListener("scroll", scheduleUpdate);
			window.removeEventListener("resize", scheduleUpdate);
		};
	}, []);

	return (
		<div className="relative overflow-x-clip bg-surface">
			<BreadcrumbListJsonLd
				items={[
					{ name: "Home", url: "/" },
					{ name: "Docs", url: "/docs" },
				]}
			/>
			{/* ── Ambient background ── */}
			<div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
				<div className="absolute inset-0 bg-grid opacity-[0.25] mask-radial" />
			</div>

			<div className="relative min-w-0">
				<Sidebar activeId={activeId} />

				<div className="min-w-0 lg:pl-72">
					<div className="mx-auto max-w-5xl min-w-0 px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-10 lg:pt-10">
						<div className="relative mb-10 overflow-hidden rounded-[var(--radius-2xl)] border border-accent/20 bg-surface/50 p-8 sm:p-10 lg:p-12 shadow-2xl">
							<div
								aria-hidden="true"
								className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent/5 blur-[80px]"
							/>
							<nav
								aria-label="Breadcrumb"
								className="flex items-center gap-1.5 text-xs text-text-muted mb-6 font-mono"
							>
								<Link href="/" className="hover:text-text transition-colors duration-200 ease-out">
									home
								</Link>
								<span className="opacity-50">/</span>
								<span className="text-text">docs</span>
							</nav>
						{/* The two hero columns measured 502x193 against 336x70 - the search
						    column carried 123px less content but `lg:items-start` pinned both
						    to the top edge, so the short one floated with all that height as
						    dead space beneath it. `lg:items-center` pairs them on a shared
						    optical centre; min-width steps 21rem -> 22rem to give the search
						    field room to breathe; the meta-strip keeps its nowrap so the
						    three facts stay on one line. */}
					<div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
						<div className="min-w-0">
							<span className="section-eyebrow-caps">API reference</span>
							<h1 className="display-headline mt-4 text-text-bright">
								API Docs
							</h1>
							<p className="page-intro max-w-2xl">
								OpenAI-compatible inference with wallet auth and x402
								credit billing. One endpoint, one key, every curated model.
							</p>
						</div>
						<div className="flex flex-col gap-3 lg:min-w-[22rem] lg:items-center lg:justify-end">
							<DocsSearch />
							<div className="meta-strip justify-start lg:justify-end lg:flex-nowrap lg:whitespace-nowrap">
								<span>OpenAI-compatible</span>
								<span>{MODEL_COUNT} models</span>
								<span>x402 on Base</span>
							</div>
						</div>
					</div>
					<div className="mt-8 flex flex-wrap items-center gap-3">
						<Link
							href="/login?next=/dashboard"
							className="btn-mono btn-primary group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void"
							>
							<span>Get API key</span>
							<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
							</Link>
						<Link
							href="#quickstart"
							className="btn-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void"
							>
							Quick Start
							</Link>
						<Link
							href="/pricing"
							className="btn-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void"
							>
							View Pricing
													</Link>
												</div>
											{/* Docs visitors arrive to evaluate, not to buy, so the signup CTA
											    gets its objection-clearing line here too. Keeps the three
											    signup surfaces (home hero, home footer CTA, docs) saying the
											    same true thing. */}
											<p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
												No credit card required · free website chat
											</p>
											</div>

					<div className="space-y-16">
						<QuickStartSection />
						<AuthenticationSection />
						<IntegrationsSection />
						<EndpointsSection />
						<AvailableModelsSection />
						<ProviderRoutingSection />
						<StreamingSection />
						<RateLimitsSection />
						<PricingSection />
						<X402Section />
						<SDKsSection />
						<ErrorsSection />
					</div>
				</div>
			</div>
		</div>
	</div>
);
}
