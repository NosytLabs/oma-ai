import { Play } from "lucide-react";
import Link from "next/link";
import { AnimatedSection, SectionHeading, TabbedCode, QUICK_START_STEPS } from "./shared";

const examples = [
	{ label: "OpenAI-compatible", lang: "bash", code: [
		'curl --fail-with-body https://www.oma-ai.com/api/v1/chat/completions \\',
		'  -H "Authorization: Bearer $OMA_API_KEY" \\',
		'  -H "Content-Type: application/json" \\',
		'  -d \'{"model":"minimax-m2-7","max_tokens":256,',
		'    "messages":[{"role":"user","content":"Hello!"}]}\'',
	].join("\n") },
	{ label: "Anthropic-compatible", lang: "bash", code: [
		'curl --fail-with-body https://www.oma-ai.com/api/v1/messages \\',
		'  -H "x-api-key: $OMA_API_KEY" \\',
		'  -H "anthropic-version: 2023-06-01" \\',
		'  -H "Content-Type: application/json" \\',
		'  -d \'{"model":"minimax-m2-7","max_tokens":256,',
		'    "messages":[{"role":"user","content":"Hello!"}]}\'',
	].join("\n") },
];

export function QuickStartSection() {
	return (
		<AnimatedSection>
			<SectionHeading id="quickstart" icon={<Play className="h-5 w-5" />} title="Quick Start"
				subtitle="Create a key, fund your balance, and call an available model with the OpenAI or Anthropic request format." />
			<div className="mb-8 grid gap-4 sm:grid-cols-3">
				{QUICK_START_STEPS.map(step => (
					<div key={step.n} id={step.id} className="rounded-[var(--radius-xl)] border border-border bg-panel p-5 scroll-mt-24">
						<div className="mb-3 flex h-8 w-8 items-center justify-center rounded-[var(--radius-lg)] bg-accent/10 text-accent text-sm font-bold font-mono">{step.n}</div>
						<h3 className="mb-1 font-semibold text-text">{step.title}</h3>
						<p className="text-sm text-text-muted">{step.desc}</p>
					</div>
				))}
			</div>
			<h3 className="mb-3 font-semibold text-text">Your first request</h3>
			<p className="mb-4 text-sm text-text-muted">
				Set OMA_API_KEY to the secret shown when you create your key. Check the <Link href="/models" className="text-accent underline underline-offset-2">live catalog</Link> before
				using the example model. Both formats call the same OMA catalog; the Anthropic format does not require a Claude model.
			</p>
			<TabbedCode tabs={examples} />
			<div className="mt-4 grid gap-3 sm:grid-cols-2">
				<div className="min-w-0 rounded-[var(--radius-lg)] border border-border bg-panel p-3">
					<h3 className="mb-1 text-xs text-text-muted">SDK base URL</h3>
					<code className="break-all text-sm text-accent">https://www.oma-ai.com/api/v1</code>
				</div>
				<div className="rounded-[var(--radius-lg)] border border-border bg-panel p-3">
					<h3 className="mb-1 text-xs text-text-muted">OpenAI SDK install</h3>
					<code className="text-sm text-accent">npm install openai</code>
				</div>
			</div>
			<p className="mt-4 text-sm text-text-muted">
				All programmatic inference spends prepaid credits. The free daily allowance is only for eligible Gonka/OpenBroker models on <Link href="/chat" className="text-accent underline underline-offset-2">website chat</Link>.
				A 402 response means add credits at <Link href="/deposit" className="text-accent underline underline-offset-2">Buy credits</Link>, then retry.
			</p>
		</AnimatedSection>
	);
}
