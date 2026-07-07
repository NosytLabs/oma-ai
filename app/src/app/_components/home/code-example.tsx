"use client";

/**
 * CodeExample — section 5 of the homepage.
 * Full-width terminal showing a real fetch call with USDC payment.
 */

import { Copy, Terminal } from "lucide-react";
import { useState } from "react";
import { Reveal } from "@/app/_components/home/reveal";
import { SectionHeader } from "@/app/_components/home/section-header";
import { cn } from "@/components/ui/utils";

export interface CodeExampleProps {
	modelCount: number;
}

function buildExampleCode(modelCount: number) {
	return `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OMA_KEY,        // one key for every model
  baseURL: "https://api.oma-ai.com/v1",
});

const response = await client.chat.completions.create({
  model: "llama-3.3-70b",            // or any of ${modelCount}+ models
  messages: [
    { role: "system", content: "You are concise." },
    { role: "user",   content: "Ship a minimal RAG agent in 3 lines." }
  ],
});

console.log(response.choices[0].message.content);
// → billed in USDC, settled on Base, no subscription`;
}

export function CodeExample({ modelCount }: CodeExampleProps) {
	return (
		<section
			aria-labelledby="code-example-headline"
			className="relative py-16 sm:py-20"
		>
			<div className="container-page">
				<Reveal>
					<SectionHeader
						headline={
							<>
								One import.
								<br />
								<span className="text-text-secondary">
									Every model underneath.
								</span>
							</>
						}
						subhead="Drop-in OpenAI compatibility. Swap baseURL, keep your SDK. Migrate per-request or per-team — no platform lock-in."
					/>
				</Reveal>

				<Reveal className="mt-12">
					<TerminalExample code={buildExampleCode(modelCount)} />
				</Reveal>
			</div>
		</section>
	);
}

function TerminalExample({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 1800);
		} catch {
			// best-effort
		}
	};

	return (
		<div className="relative">
			<div
				className="absolute -inset-px rounded-[var(--radius-md)] opacity-50 pointer-events-none"
				style={{
					background:
						"linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 40%, transparent), transparent 50%, color-mix(in srgb, var(--color-accent) 30%, transparent))",
					padding: 1,
				}}
				aria-hidden="true"
			/>

			<div className="relative surface-code overflow-hidden border-border bg-[var(--color-surface-elevated)]">
				<div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-[var(--color-surface)]">
					<span className="h-2.5 w-2.5 rounded-full bg-error" aria-hidden="true" />
					<span className="h-2.5 w-2.5 rounded-full bg-warning" aria-hidden="true" />
					<span className="h-2.5 w-2.5 rounded-full bg-success" aria-hidden="true" />
					<span className="ml-3 inline-flex items-center gap-1.5 text-[11px] text-text-muted font-mono">
						<Terminal className="h-3 w-3" aria-hidden="true" />
						~/projects/agent/index.ts
					</span>
					<button
						type="button"
						onClick={handleCopy}
						className={cn(
							"ml-auto inline-flex items-center gap-1.5 px-2.5 py-1",
							"rounded text-[11px] font-mono",
							"border border-border-bright text-text-secondary",
							"hover:border-accent hover:text-accent",
							"transition-colors duration-200",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
						)}
						aria-label={copied ? "Copied" : "Copy snippet"}
					>
						{copied ? (
							<>
								<svg
									className="h-3 w-3"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth={2}
									aria-hidden="true"
								>
									<polyline points="20 6 9 17 4 12" />
								</svg>
								Copied
							</>
						) : (
							<>
								<Copy className="h-3 w-3" aria-hidden="true" />
								Copy
							</>
						)}
					</button>
				</div>
				<pre className="p-6 sm:p-8 text-text-secondary overflow-x-auto leading-relaxed whitespace-pre">
					<code className="font-mono text-[13px] sm:text-[14px]">
						<TokenizedCode code={code} />
					</code>
				</pre>
			</div>
		</div>
	);
}

function TokenizedCode({ code }: { code: string }) {
	const tokens: { text: string; cls: string }[] = [];
	const regex =
		/(\/\/.*$)|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(\b(?:import|from|const|await|new|process|env)\b)|(\$\{[^}]+\})|(\b\w+\b)(?=\s*=)|(\b\w+\b)(?=\s*:)|(\b(?:true|false|null|undefined)\b)/gm;
	let lastIndex = 0;
	for (const match of code.matchAll(regex)) {
		if (match.index > lastIndex) {
			tokens.push({ text: code.slice(lastIndex, match.index), cls: "" });
		}
		if (match[1]) tokens.push({ text: match[1], cls: "text-text-muted italic" });
		else if (match[2] || match[3])
			tokens.push({ text: match[2] || match[3], cls: "text-[var(--color-secondary)]" });
		else if (match[4]) tokens.push({ text: match[4], cls: "text-info" });
		else if (match[5]) tokens.push({ text: match[5], cls: "text-warning" });
		else if (match[6]) tokens.push({ text: match[6], cls: "text-accent-bright" });
		else if (match[7]) tokens.push({ text: match[7], cls: "text-text-bright" });
		else if (match[8]) tokens.push({ text: match[8], cls: "text-[var(--color-tertiary)]" });
		lastIndex = match.index + match[0].length;
	}
	if (lastIndex < code.length) {
		tokens.push({ text: code.slice(lastIndex), cls: "" });
	}
	return (
		<>
			{tokens.map((t, i) => (
				<span key={i} className={t.cls || undefined}>
					{t.text}
				</span>
			))}
		</>
	);
}