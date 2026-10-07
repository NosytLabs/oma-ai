import { Play, Terminal } from "lucide-react";
import { AnimatedSection, CodeBlock, SectionHeading, QUICK_START_STEPS } from "./shared";

export function QuickStartSection() {
	const curlCode = `curl https://www.oma-ai.com/api/v1/chat/completions \\
	-H "Authorization: Bearer oma_sk_your_key_here" \\
	-H "Content-Type: application/json" \\
	-d '{
	"model": "llama-3.3-70b",
	"messages": [{"role": "user", "content": "Hello!"}]
	}'`;

	return (
		<AnimatedSection>
			<SectionHeading
				id="quickstart"
				icon={<Play className="h-5 w-5" />}
				title="Quick Start"
				subtitle="Get up and running with the OMA API in under a minute. Drop-in replacement for OpenAI with zero vendor lock-in."
			/>

			<div className="mb-8 grid gap-4 sm:grid-cols-3">
				{QUICK_START_STEPS.map((step) => (
					<div
						key={step.n}
						id={step.id}
						className="rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-5 scroll-mt-24 transition-colors hover:border-accent/40"
					>
						<div className="mb-3 flex h-8 w-8 items-center justify-center rounded-[var(--radius-lg)] bg-accent/10 text-accent text-sm font-bold font-mono">
							{step.n}
						</div>
						<h3 className="mb-1 font-semibold text-text">{step.title}</h3>
						<p className="text-sm text-text-muted">{step.desc}</p>
					</div>
				))}
			</div>

			<div className="relative rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-6">
				<div className="mb-4 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Terminal className="h-4 w-4 text-accent" />
						<h3 className="text-sm font-medium text-text">
							Your First Request
						</h3>
					</div>
					<span className="rounded-[var(--radius-md)] bg-accent/10 px-2 py-0.5 text-xs font-mono text-accent border border-accent/20">
						cURL
					</span>
				</div>
				<CodeBlock code={curlCode} lang="bash" />
			</div>

			<div className="mt-4 grid gap-3 sm:grid-cols-2">
				<div className="rounded-[var(--radius-lg)] border border-border bg-panel shadow-[var(--shadow-md)] p-3">
					<h3 className="text-xs text-text-muted mb-1">Base URL</h3>
					<code className="text-sm text-accent">https://www.oma-ai.com/api/v1</code>
				</div>
				<div className="rounded-[var(--radius-lg)] border border-border bg-panel shadow-[var(--shadow-md)] p-3">
					<h3 className="text-xs text-text-muted mb-1">SDK Install</h3>
					<code className="text-sm text-accent">npm install openai</code>
				</div>
			</div>

			<div className="mt-8">
				<h3 className="mb-3 text-sm font-semibold text-text">Using the Anthropic API format</h3>
					<CodeBlock
						lang="bash"
						title="Messages (Anthropic-compatible)"
						code={`curl https://www.oma-ai.com/api/v1/messages \\
	-H "x-api-key: oma_sk_your_key_here" \\
	-H "anthropic-version: 2023-06-01" \\
	-H "Content-Type: application/json" \\
	-d '{
	"model": "claude-sonnet-4-6",
	"max_tokens": 256,
	"messages": [{"role": "user", "content": "Hello!"}]
	}'`}
					/>
			</div>
		</AnimatedSection>
	);
}
