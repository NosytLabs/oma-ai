import { Book } from "lucide-react";
import { AnimatedSection, SectionHeading } from "./shared";

export function GlossarySection() {
	const glossary = [
		{
			term: "API Key",
			definition: "A secure string (prefixed with `oma_sk_`) used to authorize programmatic requests to OMA. Treat this as a password.",
		},
		{
			term: "Token",
			definition: "The basic unit of text processed by LLMs. One token is roughly 4 characters or 0.75 words. Inputs and outputs are billed per million tokens.",
		},
		{
			term: "Inference",
			definition: "The process of running an AI model on a server to generate a response (text, image, or video) from your prompt.",
		},
		{
			term: "EVM / Base",
			definition: "Ethereum Virtual Machine. Base is Coinbase's secure, low-cost Layer 2 blockchain network where OMA settlements and USDC deposits reside.",
		},
		{
			term: "SIWE",
			definition: "Sign-In With Ethereum. A secure, wallet-based authentication standard (EIP-4361) that lets you sign in using cryptographic signatures instead of email/passwords.",
		},
		{
			term: "x402",
			definition: "An extension of the HTTP 402 Payment Required protocol allowing autonomous agents to settle individual requests on-chain in real-time.",
		},
		{
			term: "Zero Data Retention",
			definition: "Our commitment to privacy: prompt content is never logged, stored, or cached on OMA or upstream servers.",
		},
		{
			term: "Fallback / Circuit Breaker",
			definition: "Our resilient routing logic that automatically forwards your request to alternative, equivalent models if a primary provider goes offline.",
		},
	];

	return (
		<AnimatedSection delay={550}>
			<SectionHeading
				id="glossary"
				icon={<Book className="h-5 w-5 text-accent" />}
				title="Glossary of Terms"
				subtitle="Quick reference definitions for core artificial intelligence and payment concepts."
			/>

			<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 mt-8">
				{glossary.map((g, i) => (
					<div
						key={i}
						className="rounded-lg border border-border bg-surface/30 p-4 hover:border-border-bright transition-colors"
					>
						<span className="font-mono text-xs font-bold uppercase tracking-wider text-accent">
							{g.term}
						</span>
						<p className="mt-1.5 text-xs text-text-secondary leading-relaxed">
							{g.definition}
						</p>
					</div>
				))}
			</div>
		</AnimatedSection>
	);
}
