"use client";

/**
 * AgentSessionDemo
 * ----------------
 * Static marketing demo of an agent terminal session calling OMA.
 * Visual language inspired by brainless (theswerd/brainless) session blocks
 * — Claude/Codex/Grok CLI fidelity — but fully themed to OMA tokens so we
 * don't pull the full shadcn registry into the product tree.
 *
 * Use on marketing / docs only. Live product chat remains ChatPlaygroundShell.
 *
 * @see https://github.com/theswerd/brainless
 */

import { ArrowRight, Bot, Check, Circle, Loader2, Wrench } from "lucide-react";
import Link from "next/link";
import { cn } from "@/components/ui/utils";

type Line =
 | { kind: "status"; text: string }
 | { kind: "user"; text: string }
 | { kind: "assistant"; text: string }
 | { kind: "thinking"; text: string }
 | { kind: "tool"; name: string; detail: string; done?: boolean }
 | { kind: "code"; text: string }
 | { kind: "meta"; text: string };

const DEMO_LINES: Line[] = [
 {
 kind: "status",
 text: "session · baseURL https://api.oma-ai.com/v1 · key oma_sk_…",
 },
 {
 kind: "user",
 text: "Route this chat to the cheapest good model and answer in one sentence.",
 },
 {
 kind: "thinking",
 text: "Pick budget tier · attach OpenAI-compatible client · stream tokens",
 },
 {
 kind: "tool",
 name: "POST /v1/chat/completions",
 detail: 'model: "llama-3.3-70b" · stream: true',
 done: true,
 },
 {
 kind: "code",
 text: `const client = new OpenAI({
 apiKey: process.env.OMA_KEY,
 baseURL: "https://api.oma-ai.com/v1",
});

const stream = await client.chat.completions.create({
 model: "llama-3.3-70b",
 stream: true,
 messages: [{ role: "user", content: "…" }],
});`,
 },
 {
 kind: "assistant",
 text: "Use OMA as a drop-in OpenAI base URL — one key, multi-provider routing, billed per token in USDC.",
 },
 {
 kind: "meta",
 text: "usage · 412 in · 48 out · $0.00008 · settled USDC on Base",
 },
];

function LineRow({ line }: { line: Line }) {
 if (line.kind === "status") {
 return (
 <div className="flex items-center gap-2 border-b border-border/80 bg-[color-mix(in_srgb,var(--color-panel)_80%,transparent)] px-3 py-2 font-mono text-[11px] text-text-muted">
 <span className="inline-flex h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent-glow)]" />
 <span className="truncate">{line.text}</span>
 </div>
 );
 }

 if (line.kind === "user") {
 return (
 <div className="flex w-full items-baseline gap-0 bg-surface-elevated px-3 py-2 font-mono text-[13px] leading-relaxed">
 <span className="shrink-0 text-accent" aria-hidden="true">
 ❯
 </span>
 <span className="inline-block w-[1ch] shrink-0" aria-hidden="true" />
 <span className="min-w-0 flex-1 break-words text-text-bright">
 {line.text}
 </span>
 </div>
 );
 }

 if (line.kind === "thinking") {
 return (
 <div className="flex items-start gap-2 px-3 py-2 font-mono text-[12px] text-text-muted">
 <Loader2
 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-accent/80"
 aria-hidden="true"
 />
 <span className="italic">{line.text}</span>
 </div>
 );
 }

 if (line.kind === "tool") {
 return (
 <div className="mx-3 my-1 rounded-[var(--radius-md)] border border-border bg-surface/80 px-3 py-2 font-mono text-[12px]">
 <div className="flex items-center gap-2 text-text-secondary">
 <Wrench className="h-3 w-3 shrink-0 text-accent" aria-hidden="true" />
 <span className="font-semibold text-text-bright">{line.name}</span>
 {line.done ? (
 <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-accent">
 <Check className="h-3 w-3" aria-hidden="true" />
 ok
 </span>
 ) : (
 <span className="ml-auto text-[10px] text-text-muted">running</span>
 )}
 </div>
 <p className="mt-1 pl-5 text-text-muted">{line.detail}</p>
 </div>
 );
 }

 if (line.kind === "code") {
 return (
 <pre
 tabIndex={0}
 aria-label="Code example output"
 className="mx-3 my-2 overflow-x-auto rounded-[var(--radius-md)] border border-border bg-void p-3 font-mono text-[11px] leading-relaxed text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
 >
 <code>{line.text}</code>
 </pre>
 );
 }

 if (line.kind === "meta") {
 return (
 <div className="flex items-center gap-2 px-3 py-2 font-mono text-[11px] text-text-muted">
 <Circle
 className="h-2 w-2 fill-accent text-accent"
 aria-hidden="true"
 />
 {line.text}
 </div>
 );
 }

 // assistant
 return (
 <div className="px-3 py-2 font-mono text-[13px] leading-relaxed text-text">
 {line.text}
 </div>
 );
}

export function AgentSessionDemo({ className }: { className?: string }) {
 return (
 <figure
 className={cn(
 "overflow-hidden rounded-[var(--radius-xl)] border border-border bg-panel shadow-overlay",
 className,
 )}
 aria-label="Demo agent session calling the OMA API"
 >
 {/* Title bar — terminal chrome */}
 <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-2">
 <div className="flex items-center gap-2">
 <span className="flex gap-1.5" aria-hidden="true">
 <span className="h-2.5 w-2.5 rounded-full bg-error/70" />
 <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
 <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
 </span>
 <span className="ml-2 inline-flex items-center gap-1.5 font-mono text-[11px] text-text-muted">
 <Bot className="h-3 w-3 text-accent" aria-hidden="true" />
 agent · oma gateway
 </span>
 </div>
 <span className="hidden font-mono text-[10px] uppercase tracking-widest text-text-muted sm:inline">
 demo · not live
 </span>
 </div>

 <div
 className="h-[min(420px,55vh)] overflow-y-auto py-1 focus:outline-none focus:ring-1 focus:ring-accent bg-[color-mix(in_srgb,var(--color-panel)_80%,transparent)]"
 role="region"
 aria-label="Agent session demo transcript"
 tabIndex={0}
 >
 {DEMO_LINES.map((line, i) => (
 // biome-ignore lint/suspicious/noArrayIndexKey: static demo transcript
 <LineRow key={i} line={line} />
 ))}
 </div>

 {/* Fake prompt bar */}
 <div className="flex items-center gap-2 border-t border-border bg-surface px-3 py-2.5 font-mono text-[13px]">
 <span className="text-accent" aria-hidden="true">
 ❯
 </span>
 <span className="text-text-muted">
 Ask anything — routed through OMA
 <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-accent/80 align-middle" />
 </span>
 </div>

 <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-void/60 px-3 py-2.5">
 <p className="text-[11px] text-text-muted">
 Agents speak OpenAI. Point them at{" "}
 <code className="rounded-[var(--radius-sm)] bg-surface px-1 py-0.5 font-mono text-accent">
 api.oma-ai.com/v1
 </code>
 </p>
 <div className="flex flex-wrap items-center gap-2">
 <Link
 href="/docs"
 className="inline-flex items-center gap-1 text-[11px] font-medium text-text-secondary transition-colors duration-200 ease-out hover:text-accent"
 >
 API docs
 <ArrowRight className="h-3 w-3" aria-hidden="true" />
 </Link>
 <Link
 href="/chat?demo=1"
 className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-accent px-2.5 py-1 text-[11px] font-semibold text-void transition-[background-color,transform] duration-200 ease-out hover:bg-accent-bright active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
 >
 Try live chat
 <ArrowRight className="h-3 w-3" aria-hidden="true" />
 </Link>
 </div>
 </figcaption>
 </figure>
 );
}
