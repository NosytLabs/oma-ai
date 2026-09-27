"use client";

/**
	* CodeExample — section 5 of the homepage.
	* Full-width terminal showing an OpenAI SDK call billed to prepaid credits.
	*/

import { Copy, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { Reveal } from "@/app/_components/home/reveal";
import { SectionHeader } from "@/app/_components/home/section-header";
import { cn } from "@/components/ui/utils";

import { loadRawModelEntries } from "@/lib/models-data";
import { isAvailableChatModel } from "./catalog-availability";

function buildExampleCode(modelId: string) {
	return `import { OpenAI } from "openai";

const client = new OpenAI({
	apiKey: process.env.OMA_API_KEY, // create a key in your OMA dashboard
	baseURL: "https://www.oma-ai.com/api/v1",
});

const response = await client.chat.completions.create({
	model: ${JSON.stringify(modelId)}, // check live availability at /models
	messages: [
	{ role: "system", content: "You are concise." },
	{ role: "user", content: "Ship a minimal RAG agent in 3 lines." }
	],
});

	// → charged to your prepaid OMA credits, no subscription`;
}

export function CodeExample() {
	const [modelId, setModelId] = useState("YOUR_AVAILABLE_MODEL_ID");
	useEffect(() => {
		let active = true;
		void loadRawModelEntries().then((entries) => {
			const model = entries.find(isAvailableChatModel);
			if (active && model) setModelId(model.id);
		}).catch(() => { /* Keep the explicit placeholder when availability is unknown. */ });
		return () => { active = false; };
	}, []);
	return (
		<section
			aria-labelledby="code-example-headline"
			className="relative border-t border-border-subtle py-14 sm:py-18 lg:py-22"
		>
			<div className="container-page">
				<Reveal>
					<SectionHeader
						id="code-example-headline"
						eyebrow="Quickstart"
						eyebrowVariant="caps"
						headline={
							<>
								One import.
								<br />
								<span className="text-text-secondary">
									Every model underneath.
								</span>
							</>
						}
						subhead="Drop-in OpenAI compatibility. Swap in your baseURL, keep your SDK, and move per-request or per-team. There is no platform lock-in."
					/>
				</Reveal>

				<Reveal className="mt-12">
					<TerminalExample code={buildExampleCode(modelId)} />
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
		<div className="relative max-w-full min-w-0">
			<div
				className="pointer-events-none absolute -inset-px rounded-[var(--radius-lg)] opacity-40"
				style={{
					background:
						"linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 30%, transparent), transparent 50%, color-mix(in srgb, var(--color-accent) 20%, transparent))",
					padding: 1,
				}}
				aria-hidden="true"
			/>

			<div className="relative w-full min-w-0 overflow-hidden border-border bg-[var(--color-surface-elevated)] rounded-[var(--radius-lg)] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)]">
				<div className="flex min-w-0 items-center gap-2 border-b border-border bg-[var(--color-surface)] px-4 py-2.5">
					<span className="h-2.5 w-2.5 shrink-0 rounded-full bg-error" aria-hidden="true" />
					<span className="h-2.5 w-2.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
					<span className="h-2.5 w-2.5 shrink-0 rounded-full bg-success" aria-hidden="true" />
					<span className="ml-3 inline-flex min-w-0 items-center gap-1.5 truncate font-mono text-[11px] text-text-muted">
						<Terminal className="h-3 w-3 shrink-0" aria-hidden="true" />
						<span className="truncate">~/projects/agent/index.ts</span>
					</span>
					<button
						type="button"
						onClick={handleCopy}
						className={cn(
							"ml-auto inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1",
							"rounded-[var(--radius-sm)] text-[11px] font-mono",
"border border-border-bright text-text-secondary transition-[color,border-color,background-color,transform] duration-200 ease-out active:scale-[0.97]",
						"hover:border-accent hover:text-accent",
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
				<pre
					tabIndex={0}
					aria-label="OpenAI-compatible OMA SDK client setup code example"
					className="w-full overflow-x-auto whitespace-pre p-4 text-text-secondary bg-void/90 border-t border-border/80 leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:p-8"
				>
					<code className="block w-max min-w-full font-mono text-[12px] sm:text-[14px]">
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