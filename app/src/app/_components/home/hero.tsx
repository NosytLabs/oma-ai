"use client";

/**
 * Hero — section 1 of the homepage.
 * Asymmetric split: copy on the left, animated terminal on the right.
 * No eyebrow (max 1 per 3 sections — reserved for the x402 banner).
 * Single primary CTA + single secondary CTA. Buttons do not wrap on desktop.
 */

import { m } from "@/lib/framer-motion-client";
import { ArrowRight, Copy, Terminal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const CURL_SNIPPET = `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer $OMA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.3-70b",
    "messages": [{ "role": "user", "content": "Hello!" }]
  }'`;

const container = {
	hidden: {},
	show: {
		transition: { staggerChildren: 0.12, delayChildren: 0.1 },
	},
};

const child = {
	hidden: { opacity: 0, y: 24 },
	show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
};

export interface HeroProps {
	modelCount: number;
}

export function Hero({ modelCount }: HeroProps) {
	return (
		<section
			aria-labelledby="hero-headline"
			className="relative overflow-hidden pt-20 pb-24 sm:pt-28 sm:pb-32"
		>
			<div className="aurora" aria-hidden="true" />
			<div
				className="pointer-events-none absolute inset-0 -z-10 bg-grid mask-radial opacity-40"
				aria-hidden="true"
			/>
			<div
				className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
				style={{
					background:
						"radial-gradient(ellipse at 70% 0%, color-mix(in srgb, var(--color-accent) 14%, transparent) 0%, transparent 60%)",
				}}
				aria-hidden="true"
			/>

			<div className="container-page">
				<div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center min-h-[60dvh]">
					<m.div
						className="flex flex-col items-start text-left"
						variants={container}
						initial="hidden"
						animate="show"
					>
						<m.h1
							id="hero-headline"
							className="display-headline text-text-bright"
							variants={child}
						>
							Run any model.
							<br />
							<span className="gradient-text-accent">Pay per request.</span>
						</m.h1>

						<m.p
							className="mt-6 text-lg sm:text-xl text-text-secondary leading-relaxed max-w-lg"
							variants={child}
						>
							{modelCount}+ AI models behind one OpenAI-compatible API.
							x402-native USDC payments on Base. No subscriptions, no
							monthly bills, no email.
						</m.p>

						<m.div
							className="mt-9 flex flex-wrap items-center gap-3"
							variants={child}
						>
							<Button
								asChild
								size="lg"
								rightIcon={<ArrowRight className="h-4 w-4" />}
							>
								<Link href="/login">Get API Key</Link>
							</Button>
							<Button asChild size="lg" variant="secondary">
								<Link href="/docs#x402">Try without signup</Link>
							</Button>
						</m.div>

						<m.div
							className="mt-5 flex items-center gap-2 text-xs text-text-muted font-mono"
							variants={child}
						>
							<span className="inline-block h-1.5 w-1.5 rounded-full bg-accent pulse-ring" />
							<span>
								<span className="text-text-secondary">No credit card</span>
								<span className="mx-2 text-border-bright">·</span>
								<span className="text-text-secondary">$0.05 free credit on signup</span>
								<span className="mx-2 text-border-bright">·</span>
								<span className="text-text-secondary">x402 pay-per-request</span>
								<span className="mx-2 text-border-bright">·</span>
								<span className="text-text-secondary">No prompts logged or trained on</span>
								<span className="mx-2 text-border-bright">·</span>
								<span className="text-text-secondary">From $0.06 – $3.00 / 1M tokens</span>
							</span>
						</m.div>
					</m.div>

					<m.div
						initial={{ opacity: 0, y: 32 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.3 }}
						className="w-full"
					>
						<TerminalBlock code={CURL_SNIPPET} />
					</m.div>
				</div>
			</div>
		</section>
	);
}

function TerminalBlock({ code }: { code: string }) {
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
		<div className="surface-code overflow-hidden shadow-[0_20px_60px_-30px_var(--color-accent-glow)] border-[color-mix(in_srgb,var(--color-accent)_20%,var(--color-border))]">
			<div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-[var(--color-surface)]">
				<span className="h-2.5 w-2.5 rounded-full bg-error" aria-hidden="true" />
				<span className="h-2.5 w-2.5 rounded-full bg-warning" aria-hidden="true" />
				<span className="h-2.5 w-2.5 rounded-full bg-success" aria-hidden="true" />
				<span className="ml-3 inline-flex items-center gap-1.5 text-[11px] text-text-muted font-mono">
					<Terminal className="h-3 w-3" aria-hidden="true" />
					api.oma-ai.com
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
			<pre className="p-5 text-text-secondary overflow-x-auto leading-relaxed whitespace-pre">
				<code className="font-mono text-[12px] sm:text-[13px]">
					<TokenizedCode code={code} />
				</code>
			</pre>
		</div>
	);
}

function TokenizedCode({ code }: { code: string }) {
	const tokens: { text: string; cls: string }[] = [];
	const regex =
		/(\$[A-Z_]+)|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(curl\b)|(--?[a-zA-Z-]+)|(https?:\/\/[^\s\\]+)|(\b\w+\b)(?=\s*:)/g;
	let lastIndex = 0;
	for (const m of code.matchAll(regex)) {
		if (m.index > lastIndex) {
			tokens.push({ text: code.slice(lastIndex, m.index), cls: "" });
		}
		if (m[1]) tokens.push({ text: m[1], cls: "text-accent font-medium" });
		else if (m[2] || m[3])
			tokens.push({ text: m[2] || m[3], cls: "text-[var(--color-secondary)]" });
		else if (m[4]) tokens.push({ text: m[4], cls: "text-info" });
		else if (m[5]) tokens.push({ text: m[5], cls: "text-text-muted" });
		else if (m[6]) tokens.push({ text: m[6], cls: "text-[var(--color-tertiary)]" });
		else if (m[7]) tokens.push({ text: m[7], cls: "text-accent-bright" });
		lastIndex = m.index + m[0].length;
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