import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, MessageSquare, Shield } from "lucide-react";
import { ContactForm } from "./ContactForm";
import { InViewFade } from "@/components/motion/in-view-fade";
import { BreadcrumbListJsonLd } from "@/components/json-ld";

export const metadata: Metadata = {
	title: "Contact OMA — support & privacy",
	description:
		"Contact OMA AI for product support, privacy requests, and legal questions. Email support@nosytlabs.com or hi@nosytlabs.com.",
	alternates: { canonical: "/contact" },
	openGraph: {
		title: "Contact OMA",
		description:
			"Product support, privacy requests, and legal questions for the OMA AI gateway.",
		images: [{ url: "/og-image.webp", width: 1280, height: 720, alt: "Contact OMA" }],
	},
	robots: { index: true, follow: true },
};

const CHANNELS = [
	{
		icon: MessageSquare,
		title: "Product support",
		body: "API keys, deposits, model routing, and dashboard issues.",
		href: "mailto:support@nosytlabs.com",
		label: "support@nosytlabs.com",
	},
	{
		icon: Shield,
		title: "Privacy & data requests",
		body: "Account deletion, data export, and DPA / sub-processor questions.",
		href: "mailto:support@nosytlabs.com",
		label: "support@nosytlabs.com",
	},
	{
		icon: Mail,
		title: "Legal",
		body: "Terms, acceptable use, and partnership inquiries.",
		href: "mailto:hi@nosytlabs.com",
		label: "hi@nosytlabs.com",
	},
] as const;

export default function ContactPage() {
	return (
		<div className="bg-void text-text overflow-x-clip">
			<BreadcrumbListJsonLd
				items={[
					{ name: "Home", url: "/" },
					{ name: "Contact", url: "/contact" },
				]}
			/>
			<div className="container-page page-content max-w-3xl lg:max-w-4xl">
				<InViewFade eager>
				<Link
					href="/"
					className="flex w-fit min-h-11 items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors duration-200 ease-out mb-10"
				>
					<ArrowLeft className="h-4 w-4" aria-hidden="true" />
					Home
				</Link>

			<span className="section-eyebrow-caps">
				contact
			</span>
			<h1 className="display-headline mt-3 text-text-bright">
				How to reach OMA
			</h1>
			<p className="page-intro mt-4 mb-10 max-w-2xl">
					We are a lean team. Email is the fastest channel. We reply within one
					business day for outages, and typically within five for privacy
					requests.
					OMA AI / Open Model Access is operated by{" "}
					<a
						href="https://www.nosytlabs.com"
						target="_blank"
						rel="noopener noreferrer"
						className="text-accent hover:underline underline-offset-2"
					>
						NosytLabs
					</a>
					.
				</p>
				</InViewFade>

				<InViewFade>
				<ul className="space-y-4">
					{CHANNELS.map((c) => (
						<li
							key={c.title}
							className="rounded-[var(--radius-xl)] border border-border bg-surface p-5 hover:border-accent/40 transition-colors duration-200 ease-out"
						>
							<div className="flex items-start gap-3">
								<c.icon
									className="h-5 w-5 text-accent shrink-0 mt-0.5"
									aria-hidden="true"
								/>
								<div>
									<h2 className="text-base font-display font-medium text-text-bright">
										{c.title}
									</h2>
									<p className="mt-1 text-sm text-text-secondary leading-relaxed">
										{c.body}
									</p>
									<a
										href={c.href}
										className="mt-3 inline-block text-sm font-mono text-accent underline underline-offset-2 hover:text-accent-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
									>
										{c.label}
									</a>
								</div>
							</div>
						</li>
					))}
				</ul>
				</InViewFade>

				<ContactForm />

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
