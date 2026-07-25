import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, MessageSquare, Shield } from "lucide-react";
import { FloatingIcons } from "@/components/floating-icons";
import { BreadcrumbListJsonLd } from "@/components/json-ld";

export const metadata: Metadata = {
	title: "Contact OMA — support & privacy",
	description:
		"Contact OMA AI for product support, privacy requests, and legal questions. Email support@oma-ai.com or privacy@oma-ai.com.",
	alternates: { canonical: "/contact" },
	openGraph: {
		title: "Contact OMA",
		description:
			"Product support, privacy requests, and legal questions for the OMA AI gateway.",
		images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "Contact OMA" }],
	},
	robots: { index: true, follow: true },
};

const CHANNELS = [
	{
		icon: MessageSquare,
		title: "Product support",
		body: "API keys, deposits, model routing, and dashboard issues.",
		href: "mailto:support@oma-ai.com",
		label: "support@oma-ai.com",
	},
	{
		icon: Shield,
		title: "Privacy & data requests",
		body: "Account deletion, data export, and DPA / sub-processor questions.",
		href: "mailto:privacy@oma-ai.com",
		label: "privacy@oma-ai.com",
	},
	{
		icon: Mail,
		title: "Legal",
		body: "Terms, acceptable use, and partnership inquiries.",
		href: "mailto:legal@oma-ai.com",
		label: "legal@oma-ai.com",
	},
] as const;

export default function ContactPage() {
	return (
		<div className="min-h-screen bg-void text-text">
			<BreadcrumbListJsonLd
				items={[
					{ name: "Home", url: "/" },
					{ name: "Contact", url: "/contact" },
				]}
			/>
			<FloatingIcons />
			<div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
				<Link
					href="/"
					className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors mb-10"
				>
					<ArrowLeft className="h-4 w-4" aria-hidden="true" />
					Home
				</Link>

				<p className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent mb-3">
					contact
				</p>
				<h1 className="text-3xl sm:text-4xl font-semibold text-text-bright mb-4">
					How to reach OMA
				</h1>
				<p className="text-text-secondary max-w-xl mb-12 leading-relaxed">
					We are a lean team. Email is the fastest channel. We typically reply
					within five business days for privacy requests and sooner for outages.
				</p>

				<ul className="space-y-4">
					{CHANNELS.map((c) => (
						<li
							key={c.title}
							className="rounded-xl border border-border bg-surface p-5 hover:border-accent/40 transition-colors"
						>
							<div className="flex items-start gap-3">
								<c.icon
									className="h-5 w-5 text-accent shrink-0 mt-0.5"
									aria-hidden="true"
								/>
								<div>
									<h2 className="text-base font-semibold text-text-bright">
										{c.title}
									</h2>
									<p className="mt-1 text-sm text-text-secondary leading-relaxed">
										{c.body}
									</p>
									<a
										href={c.href}
										className="mt-3 inline-block text-sm font-mono text-accent underline underline-offset-2 hover:text-accent-bright"
									>
										{c.label}
									</a>
								</div>
							</div>
						</li>
					))}
				</ul>

				<p className="mt-12 text-sm text-text-muted">
					Prefer self-serve? Read the{" "}
					<Link href="/docs" className="text-accent underline underline-offset-2">
						API docs
					</Link>
					,{" "}
					<Link
						href="/privacy"
						className="text-accent underline underline-offset-2"
					>
						privacy policy
					</Link>
					, or{" "}
					<Link href="/terms" className="text-accent underline underline-offset-2">
						terms
					</Link>
					.
				</p>
			</div>
		</div>
	);
}
