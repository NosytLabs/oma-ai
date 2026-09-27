import { Play, Terminal, Copy, Check } from "lucide-react";
import { useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import { AnimatedSection, CodeBlock, SectionHeading, QUICK_START_STEPS } from "./shared";

// Compact per-modality curl blocks. Each block's code defaults to a
// bash snippet, matching the real /v1/* surface: chat completions.
function ModalityExample({ title, code }: { title: string; code: string }) {
	const [copied, setCopied] = useState(false);
	const looksLikeCurl = code.trimStart().startsWith("curl");
	const isInteractive = looksLikeCurl || !code.trimStart().startsWith("#");

	return (
		<div className="rounded-[var(--radius-lg)] border border-border bg-panel shadow-[var(--shadow-md)] p-4 relative group">
			<div className="mb-2 flex items-center justify-between">
				<span className="text-xs font-semibold text-text-secondary font-mono uppercase tracking-wider">
					{title}
				</span>
				<div className="flex items-center gap-1.5">
					{looksLikeCurl && (
						<span className="rounded-[var(--radius-md)] bg-accent/10 px-1.5 py-0.5 text-[10px] font-mono text-accent border border-accent/20">
							cURL
						</span>
					)}
					{isInteractive && (
						<button
							type="button"
							onClick={() => {
								void copyToClipboard(code).then((ok) => {
									if (!ok) return;
									setCopied(true);
									setTimeout(() => setCopied(false), 2000);
								});
							}}
							className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200 ease-out p-1 min-h-6 min-w-6 inline-flex items-center justify-center text-text-muted hover:text-accent"
							aria-label={copied ? "Copied" : "Copy code"}
						>
							{copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
						</button>
					)}
				</div>
			</div>
			<pre className="overflow-x-auto rounded-[var(--radius-md)] bg-void/40 p-3 text-[11px] leading-snug font-mono text-text-secondary whitespace-pre">
{code}
			</pre>
		</div>
	);
}

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

			{/* Per-modality examples — copyable from the docs page so users see
			 every supported modality at a glance. Each block uses the
			 OpenAI-compatible surface so SDKs work out-of-the-box. OMA
			 serves chat completions only (text + multimodal input); image
			 and video generation endpoints were intentionally removed. */}
			<div className="mt-10 space-y-4">
				<p className="text-xs font-mono uppercase tracking-widest text-text-muted">
					Chat · Anthropic messages · curl
				</p>
				<div className="grid gap-3 md:grid-cols-2">
					<ModalityExample
						title="Chat (OpenAI-compatible)"
						code={`curl https://www.oma-ai.com/api/v1/chat/completions \\
		-H "Authorization: Bearer oma_sk_your_key_here" \\
		-H "Content-Type: application/json" \\
		-d '{
	"model": "llama-3.3-70b",
	"messages": [{"role": "user", "content": "Hello!"}]
	}'`}
					/>
					<ModalityExample
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
			</div>
		</AnimatedSection>
	);
}
