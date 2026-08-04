// production URL (https://api.oma-ai.com/v1) — references resolve once the gateway is deployed (audit C-1).
"use client";

import { ArrowRight, Menu, Terminal, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { MODEL_COUNT } from "@/lib/models-data";
import { FloatingIcons } from "@/components/floating-icons";
import { BreadcrumbListJsonLd } from "@/components/json-ld";
import { DocsSearch } from "./_components/DocsSearch";
import { NAV_ITEMS } from "./_lib/nav-data";

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
import { FAQSection } from "./sections/faq";
import { GlossarySection } from "./sections/glossary";

/* ==================== SIDEBAR ==================== */

function Sidebar({ activeId }: { activeId: string }) {
	const [mobileOpen, setMobileOpen] = useState(false);
	const mobileNavId = useId();
	const [isMobile, setIsMobile] = useState(false);
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
			<button
				type="button"
				onClick={() => setMobileOpen(!mobileOpen)}
				className="fixed bottom-6 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-void shadow-lg lg:hidden"
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
					className="fixed inset-0 z-40 bg-void/80 backdrop-blur-sm lg:hidden cursor-default"
					onClick={() => setMobileOpen(false)}
					aria-label="Close navigation menu"
				/>
			)}

			<aside
				id={mobileNavId}
				aria-label="Documentation navigation"
				aria-hidden={drawerHidden}
				inert={drawerHidden}
				className={`fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-56 lg:w-72 overflow-y-auto border-r border-border bg-void transition-transform lg:translate-x-0 ${
					mobileOpen ? "translate-x-0" : "-translate-x-full"
				}`}
			>
				<div className="p-4">
					<div className="mb-4 rounded-xl bg-accent/10 p-3 border border-accent/20">
						<div className="flex items-center gap-2">
							<Terminal className="h-4 w-4 text-accent" />
							<span className="text-sm font-semibold text-accent">OMA API</span>
						</div>
						<p className="mt-1 text-xs text-text-muted">v2.1.0</p>
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
									className={`relative flex items-center gap-3 rounded-lg px-3 py-3 min-h-[48px] text-sm transition-all ${
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

/* ==================== PAGE ==================== */

function DocsContent() {
	const [activeId, setActiveId] = useState("quickstart");

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) setActiveId(entry.target.id);
				});
			},
			{ rootMargin: "-20% 0px -70% 0px" },
		);
		NAV_ITEMS.forEach((item) => {
			const el = document.getElementById(item.id);
			if (el) observer.observe(el);
		});
		return () => observer.disconnect();
	}, []);

	return (
		<div className="relative min-h-screen bg-void">
			<BreadcrumbListJsonLd
				items={[
					{ name: "Home", url: "/" },
					{ name: "Docs", url: "/docs" },
				]}
			/>
			{/* ── Ambient background ── */}
			<div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
				<FloatingIcons count={4} />
			</div>

			<div className="relative min-w-0">
			<Sidebar activeId={activeId} />

			<div className="min-w-0 lg:pl-72">
				<div className="mx-auto max-w-5xl min-w-0 px-4 py-3 sm:px-6 lg:px-10">
					<div className="page-hero mb-10 rounded-[calc(var(--radius-lg)+4px)] border border-[color-mix(in_srgb,var(--color-border-bright)_42%,var(--color-border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-panel)_94%,white_6%)_0%,var(--color-panel)_100%)] p-6 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.92)] sm:p-8">
						<nav
							aria-label="Breadcrumb"
							className="flex items-center gap-1.5 text-xs text-text-muted mb-3 font-mono"
						>
							<Link href="/" className="hover:text-text transition-colors">
								home
							</Link>
							<span className="opacity-50">/</span>
							<span className="text-text-secondary">dev</span>
							<span className="opacity-50">/</span>
							<span className="text-text">docs</span>
						</nav>
						<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
							<div>
								<span className="page-kicker">Developer reference</span>
								<h1 className="display-headline mt-4 text-text-bright">
									API Documentation
								</h1>
								<p className="page-intro mt-4 max-w-2xl">
									OpenAI-compatible AI inference with wallet auth, x402
									pay-per-request flows, and a catalog of{" "}
									{MODEL_COUNT}+ models behind one endpoint. Buy credits
									with card via Polar, or pay per call with USDC on Base.
								</p>
							</div>
							<div className="flex flex-col gap-3 lg:min-w-[15rem] lg:items-end">
								<DocsSearch />
								<div className="meta-strip justify-start lg:justify-end">
									<span>OpenAI-compatible</span>
									<span>{MODEL_COUNT}+ models</span>
									<span>x402 on Base</span>
								</div>
							</div>
						</div>
						<div className="mt-7 flex flex-wrap gap-3">
							<Link
								href="/login"
								className="btn-primary inline-flex min-h-11 items-center gap-2 px-5"
							>
								Get API Key
								<ArrowRight className="h-4 w-4" aria-hidden="true" />
							</Link>
							<Link
								href="#quickstart"
								className="btn-secondary inline-flex min-h-11 items-center px-5"
							>
								Quick Start
							</Link>
							<Link
								href="/pricing"
								className="inline-flex min-h-11 items-center rounded-full px-5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface hover:text-text-bright"
							>
								View Pricing
							</Link>
						</div>
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
						<FAQSection />
						<GlossarySection />
						<ErrorsSection />
					</div>
				</div>
				</div>
			</div>
		</div>
	);
}

export default function DocsPage() {
	return <DocsContent />;
}
