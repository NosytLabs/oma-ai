import { CheckCircle2, HelpCircle } from "lucide-react";
import { AnimatedSection, SectionHeading } from "./shared";

export function FAQSection() {
	const faqs = [
		{
			q: "I have never used an AI API before. How do I start?",
			a: "It is easy! Sign in with your email or connect a web3 wallet to get an API key. This key is like a password that lets your software talk to AI models. You can add credits with a regular credit card via Polar (no crypto needed) or deposit USDC if you prefer. Once you have a key, you can paste it into any tool or agent that accepts OpenAI, such as Claude Code, Cursor, or LibreChat.",
		},
		{
			q: "What are 'credits' and how does pricing work?",
			a: "OMA is pay-as-you-go with no monthly fees. You load 'credits' onto your account (where 1 credit = $1.00 USD). As your code or agent makes requests, your balance is charged based on the exact number of 'tokens' (words/parts of words) sent and received. Budget models cost as little as $0.015 per million tokens, meaning a single dollar can fund thousands of interactions.",
		},
		{
			q: "What is an 'Agent' and why do they need OMA?",
			a: "An AI agent is an autonomous script or application (like Claude Code or a custom python agent) that performs multi-step tasks for you. Agents often burn through tokens quickly and benefit from multi-provider fallback. OMA acts as a secure, fast gateway that automatically swaps to equivalent backup models if a specific provider has a transient outage, keeping your agents running smoothly.",
		},
		{
			q: "What are Venice and Gonka?",
			a: "Venice AI is a leading privacy-first LLM provider with zero data retention policies. Gonka (OpenBroker) is OMA's high-speed budget provider fallback. OMA coordinates requests between these upstreams to find you the best price, latency, and uptime without your code having to handle complex routing.",
		},
		{
			q: "Do I have to use crypto or web3?",
			a: "Absolutely not. While OMA is built with crypto-native foundations, we are fully integrated with Polar so you can pay with Visa, Mastercard, or Apple Pay. Simply select 'Card' on the deposit page to check out in seconds. We issue credits to your account instantly.",
		},
		{
			q: "What is x402 and how do agents pay per request?",
			a: "x402 is an experimental HTTP 402 protocol for agent-to-agent transactions. Instead of pre-funding a centralized account with an API key, an AI agent can sign a digital USDC payment (using gasless EIP-3009 transfer authorizations on Base) and settle individual inference requests directly on-chain. This lets AI agents hold their own funds and buy their own compute autonomously.",
		},
	];

	return (
		<AnimatedSection delay={500}>
			<SectionHeading
				id="faq"
				icon={<HelpCircle className="h-5 w-5 text-accent" />}
				title="Frequently Asked Questions"
				subtitle="Common answers for developers, teams, and newcomers to the OMA AI ecosystem."
			/>

			<div className="grid gap-6 md:grid-cols-2 mt-8">
				{faqs.map((faq, i) => (
					<div
						key={i}
						className="rounded-xl border border-border bg-panel p-5 sm:p-6 shadow-sm hover:border-border-hi transition-colors"
					>
						<h3 className="font-heading text-md font-semibold text-text-bright flex items-start gap-2.5">
							<CheckCircle2 className="h-4 w-4 text-accent mt-1 shrink-0" aria-hidden="true" />
							<span>{faq.q}</span>
						</h3>
						<p className="mt-2.5 text-xs sm:text-sm text-text-secondary leading-relaxed pl-6.5">
							{faq.a}
						</p>
					</div>
				))}
			</div>
		</AnimatedSection>
	);
}
