"use client";

/**
	* Hero · LiveRequestCard
	*
	* Drop-in for the static og-image in the hero. Renders an illustrative, animated
	* terminal that types a curl → /v1/chat/completions request, then streams
	* a token-by-token reply, then resets and picks the next model. Pure CSS +
	* requestAnimationFrame — no third-party deps. Honors prefers-reduced-motion.
	*
	* The card itself stays locked at the dimensions the original image used
	* (~520×420 on desktop) so layout doesn't shift while the animation cycles.
	*/

import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/utils";

interface DemoRound {
	model: string;
	modelLabel: string;
	prompt: string;
	reply: string;
}

const ROUNDS: DemoRound[] = [
	{
	model: "claude-opus-5",
	modelLabel: "Claude Opus 5",
	prompt: "Summarize OMA in one sentence.",
	reply:
	"One gateway for the OMA catalog. Fund credits with USDC, or card checkout when available.",
	},
	{
	model: "deepseek-v4-flash-0731-openbroker",
	modelLabel: "DeepSeek V4 Flash",
	prompt: "How do I pay without a card?",
	reply: "Deposit USDC on Base, or settle USDC via x402 to credit your balance.",
	},
	{
	model: "llama-3.3-70b",
	modelLabel: "Llama 3.3 70B",
	prompt: "What's the cheapest chat model?",
	reply: "Check the live model catalog for current prices and availability.",
	},
];

type Phase = "typing" | "streaming" | "settled" | "pause";

const TYPE_SPEED_MS = 6;
const TOKEN_SPEED_MS = 28;
const SETTLE_HOLD_MS = 2600;
const PAUSE_MS = 500;
/** Cadence for the reduced-motion rotation: no typing, no token animation. */
const REDUCED_MOTION_MS = 3200;

/**
 * Badge label + colour per phase, declared in request-lifecycle order.
 *
 * These used to be two independent inline ternaries (`isSettled ? … :
 * isStreaming ? …`) where the colour chain and the label chain had to be
 * kept in sync by hand — and where the `pause` phase had no label of its own
 * and silently inherited `settled`'s "complete", so the badge read "complete"
 * while the card was actually mid-reset. One table, keyed by phase, in
 * lifecycle order: typing → sending → streaming → complete.
 */
const PHASE_BADGE: Record<Phase, { label: string; className: string }> = {
	typing: {
		label: "example · sending",
		className: "bg-warning/15 text-warning animate-pulse",
	},
	streaming: {
		label: "example · streaming",
		className: "bg-info/15 text-info",
	},
	settled: {
		label: "example · complete",
		className: "bg-accent/15 text-accent",
	},
	pause: {
		label: "example · complete",
		className: "bg-accent/15 text-accent",
	},
};

export function LiveRequestCard({ className }: { className?: string }) {
	const [roundIdx, setRoundIdx] = useState(0);
	const [phase, setPhase] = useState<Phase>("typing");
	const [typed, setTyped] = useState("");
	const [streamed, setStreamed] = useState("");
	const timerRef = useRef<number | null>(null);

	const round = ROUNDS[roundIdx];

	// Build the static request lines that always render in full.
	const requestHeader = `POST /api/v1/chat/completions HTTP/1.1
Host: www.oma-ai.com
Authorization: Bearer $OMA_KEY
Content-Type: application/json`;
	const requestBody = `{
	"model": "${round.model}",
	"stream": true,
	"messages": [{ "role": "user", "content": ${JSON.stringify(round.prompt)} }]
}`;

	useEffect(() => {
			const reduce =
				typeof window !== "undefined" &&
				window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
			if (reduce) {
				// Reduced motion means "no typing / no token animation", not "no
				// content". The old branch painted one frozen request and never
				// advanced, so the card read as a dead static screenshot. Advance
				// through all ROUNDS on a fixed interval instead — each round
				// swaps the complete request+reply pair with no per-frame motion,
				// and the interval is cleared on unmount / roundIdx change.
				const fullRequest = requestHeader + "\n\n" + requestBody;
				setTyped(fullRequest);
				setStreamed(round.reply);
				setPhase("settled");
				timerRef.current = window.setInterval(() => {
					setRoundIdx((p) => (p + 1) % ROUNDS.length);
				}, REDUCED_MOTION_MS);
				const reducedTimer = timerRef;
				return () => {
					if (reducedTimer.current !== null) {
						window.clearInterval(reducedTimer.current);
					}
				};
			}

	const fullRequest = requestHeader + "\n\n" + requestBody;
	let i = 0;
	const typeNext = () => {
	i += 1;
	setTyped(fullRequest.slice(0, i));
	if (i < fullRequest.length) {
	timerRef.current = window.setTimeout(typeNext, TYPE_SPEED_MS);
	} else {
	setPhase("streaming");
	let j = 0;
	const streamNext = () => {
	j += 1;
	setStreamed(round.reply.slice(0, j));
	if (j < round.reply.length) {
	timerRef.current = window.setTimeout(streamNext, TOKEN_SPEED_MS);
	} else {
	setPhase("settled");
	const t1 = window.setTimeout(() => {
	setPhase("pause");
	const t2 = window.setTimeout(() => {
	setTyped("");
	setStreamed("");
	setRoundIdx((p) => (p + 1) % ROUNDS.length);
	setPhase("typing");
	}, PAUSE_MS);
	timerRef.current = t2;
	}, SETTLE_HOLD_MS);
	timerRef.current = t1;
	}
	};
	timerRef.current = window.setTimeout(streamNext, 220);
	}
	};
	timerRef.current = window.setTimeout(typeNext, 350);

	const currentTimer = timerRef;
	return () => {
	if (currentTimer.current !== null) {
	window.clearTimeout(currentTimer.current);
	}
	};
	}, [roundIdx]);

	const isTyping = phase === "typing";
	const isStreaming = phase === "streaming";
	const isSettled = phase === "settled" || phase === "pause";
	const showCursor = isTyping || isStreaming;
	const badge = PHASE_BADGE[phase];

	return (
	<div
	aria-label={`Illustrative OMA API request · ${round.modelLabel}`}
	className={cn(
	"relative overflow-hidden rounded-[var(--radius-xl)] border border-border-hi",
	"bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-surface-elevated)_94%,transparent),var(--color-panel))]",
	"shadow-[0_30px_60px_-30px_rgba(0,0,0,0.85)] backdrop-blur-sm w-full max-w-[560px] text-left",
	// Compact height — animation cycles between requests without layout shift
	"min-h-[340px] md:min-h-[360px] flex flex-col",
	className,
	)}
	>
	{/* Atmospheric glow */}
	<div
	aria-hidden="true"
	className="pointer-events-none absolute inset-0 -z-10"
	>
	<div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-accent/[0.10] blur-[110px]" />
	<div className="absolute -right-20 -bottom-24 h-64 w-64 rounded-full bg-tertiary/[0.07] blur-[110px]" />
	</div>

	<div
	aria-hidden="true"
	className="pointer-events-none absolute inset-0 z-10 opacity-[0.035]"
	style={{
	backgroundImage:
	"repeating-linear-gradient(180deg, transparent 0, transparent 3px, var(--color-accent) 4px)",
	}}
	/>

	{/* Title bar */}
	<div className="flex items-center gap-2 border-b border-border px-4 py-3">
	<span
	className="h-2.5 w-2.5 rounded-full bg-error/85"
	aria-hidden="true"
	/>
	<span
	className="h-2.5 w-2.5 rounded-full bg-warning/85"
	aria-hidden="true"
	/>
	<span
	className="h-2.5 w-2.5 rounded-full bg-success/85"
	aria-hidden="true"
	/>
	<span className="ml-3 truncate font-mono text-[11px] text-text-muted">
	www.oma-ai.com/api/v1/chat/completions
	</span>
	<span
			className={cn(
	 "ml-auto shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[10px] tracking-wider pr-3",
	 isSettled
	   ? "bg-accent/15 text-accent"
	   : isStreaming
		 ? "bg-info/15 text-info"
		 : "bg-warning/15 text-warning animate-pulse",
			)}
	>
			{isSettled
	 ? "example · complete"
	 : isStreaming
	   ? "example · streaming"
	   : "example · sending"}
	</span>
	</div>

	{/* Request */}
	<pre
	aria-hidden="true"
	className="m-0 max-w-full overflow-x-auto px-4 pt-3 pb-2 font-mono text-[11.5px] leading-relaxed text-text-secondary sm:text-[12px]"
	>
	<code className="block min-w-max">
	{typed.split("\n").map((line, idx) => {
	if (line.startsWith("POST"))
	return (
	<span key={idx} className="block">
	<span className="text-accent">POST</span>
	<span className="text-text">{line.slice(4)}</span>
	</span>
	);
	if (line.startsWith("Host:"))
	return (
	<span key={idx} className="block">
	<span className="text-text-muted">Host:</span>{" "}
	<span className="text-info">www.oma-ai.com</span>
	</span>
	);
	if (line.startsWith("Authorization:"))
	return (
	<span key={idx} className="block">
	<span className="text-text-muted">Authorization:</span>{" "}
	<span className="text-secondary">Bearer $OMA_KEY</span>
	</span>
	);
	if (line.startsWith("Content-Type:"))
	return (
	<span key={idx} className="block">
	<span className="text-text-muted">Content-Type:</span>{" "}
	<span className="text-info">application/json</span>
	</span>
	);
	return (
	<span key={idx} className="block text-text-secondary">
	{line || "\u00a0"}
	</span>
	);
	})}
	{showCursor && (
	<span
	aria-hidden="true"
	className="ml-0.5 inline-block h-3.5 w-1.5 -mb-0.5 bg-accent/80 animate-pulse"
	/>
	)}
	</code>
	</pre>

	{/* Divider */}
	<div className="mx-4 my-1 flex items-center gap-3">
	<div className="h-px flex-1 bg-border" />
	<span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
	{isSettled ? "demo reply" : isStreaming ? "streaming" : "request"}
	</span>
	<div className="h-px flex-1 bg-border" />
	</div>

	<p className="px-4 pt-2 text-[11px] text-text-muted">
	Illustrative request and response. Check the catalog for live availability.
	</p>
	{/* Response */}
	<div className="px-4 pb-4 pt-2 font-mono text-[12px] leading-relaxed sm:text-[12.5px]">
	<div className="flex items-baseline gap-2">
	<span className="text-text-muted">$</span>
	<span className="text-text-secondary">{round.prompt}</span>
	</div>
	<div className="mt-2 text-accent">
	{streamed}
	{isStreaming && (
	<span
	aria-hidden="true"
	className="ml-0.5 inline-block h-3.5 w-1.5 -mb-0.5 bg-accent/80 animate-pulse"
	/>
	)}
	</div>
	{isSettled && (
	<div className="mt-3 flex flex-wrap gap-2">
	<span className="rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
	model · {round.modelLabel}
	</span>
	<span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
	API usage · prepaid credits
	</span>
	</div>
	)}
	</div>
	</div>
	);
}
