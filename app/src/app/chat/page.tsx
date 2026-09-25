"use client";

/**
 * /chat — public playground entry point.
 *
 * Renders a lightweight loading shell during SSR, then streams the heavy
 * client-only ChatPlaygroundShell (framer-motion + wallet hooks + chat
 * persistence).
 */

import { AlertTriangle } from "lucide-react";
import nextDynamic from "next/dynamic";
import { ThinkingOrb } from "thinking-orbs";
import { ErrorBoundary } from "@/components/error-boundary";
import Link from "next/link";

// Lazy-load the chat shell (framer-motion + wallet hooks) with a branded
// ThinkingOrb fallback so first paint is never a blank main region.
const ChatPlaygroundShell = nextDynamic(
	() =>
		import("./_components/ChatPlaygroundShell").then((m) => ({
			default: m.ChatPlaygroundShell,
		})),
	{
		ssr: false,
		loading: () => (
			<div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
				<div className="flex flex-col items-center gap-4">
					<ThinkingOrb
						state="searching"
						size={64}
						theme="auto"
						aria-label="Loading chat"
					/>
					<p className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
						Loading playground…
					</p>
					<div
						className="animate-shimmer h-1.5 w-48 max-w-full rounded-full bg-surface-elevated"
						aria-hidden="true"
					/>
				</div>
			</div>
		),
	},
);

export default function ChatPage() {
	return (
		// Bound the playground to the viewport instead of letting it grow.
		// The root layout uses `min-h-dvh`, so `flex-1` here had no definite
		// basis: the flex chain sized to content, the document grew past the
		// viewport, and the composer's metadata row (remaining guest quota,
		// token count, cost estimate) fell below the fold — by 19px on a
		// 390x844 phone, 74px at 1440x900, and 142px at 1280x720. On a chat
		// surface the input and its cost/quota readout must always be
		// reachable without scrolling the page; only the message list
		// should scroll.
		//
		// 57px is the Navbar height, measured identical at 390/768/1280/1440/
		// 1920. e2e/chat-viewport.spec.ts asserts the composer's metadata
		// stays on screen at each of those widths, so a Navbar height change
		// fails CI rather than silently clipping the composer.
		<div className="flex h-[calc(100dvh-57px)] min-h-0 flex-col overflow-hidden">
		<nav aria-label="Chat resources" className="absolute right-3 top-2 z-20 flex gap-3 text-xs text-text-muted sm:right-5">
			<Link href="/models" className="hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Models</Link>
			<Link href="/getting-started" className="hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Getting started</Link>
			<Link href="/faq" className="hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">FAQ</Link>
		</nav>
		<ErrorBoundary
			fallback={
				<div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
					<AlertTriangle className="h-8 w-8 text-error mb-4" />
					<h2 className="text-lg font-medium text-text mb-2">
						Chat encountered an error
					</h2>
					<p className="text-sm text-text-secondary mb-4">
						Please try refreshing the page
					</p>
					<button
						type="button"
						onClick={() => window.location.reload()}
						className="px-4 py-2 text-xs font-medium rounded-[var(--radius-lg)] bg-surface-elevated border border-border hover:border-accent/50 transition-[color,background-color,border-color,transform] duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void"
					>
						Refresh page
					</button>
				</div>
			}
		>
			<ChatPlaygroundShell
				variant="chat"
				storageKey="oma_chat_conversation"
				systemPromptKey="oma_chat_system_prompt"
			/>
		</ErrorBoundary>
		</div>
	);
}
