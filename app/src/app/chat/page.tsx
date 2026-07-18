"use client";

import { AlertTriangle } from "lucide-react";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { LiveModelsProvider } from "@/components/chat/chat-message-shared";

// Lazy-load the 569-line chat shell (framer-motion + wallet hooks).
const ChatPlaygroundShell = dynamic(
	() =>
		import("./_components/ChatPlaygroundShell").then((m) => ({
			default: m.ChatPlaygroundShell,
		})),
	{ ssr: false },
);

function ChatLoadingFallback() {
	return (
		<div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
			<div className="space-y-4">
				<div className="animate-shimmer h-8 w-48 rounded bg-surface-elevated" />
				<div className="animate-shimmer h-20 w-full max-w-2xl rounded bg-surface-elevated" />
				<div className="animate-shimmer h-16 w-full max-w-2xl rounded bg-surface-elevated" />
			</div>
		</div>
	);
}

export default function ChatPage() {
	return (
		<ErrorBoundary
			fallback={
				<div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
					<AlertTriangle className="h-8 w-8 text-error mb-4" />
					<h2 className="text-lg font-medium text-text mb-2">
						Chat encountered an error
					</h2>
					<p className="text-sm text-text-muted mb-4">
						Please try refreshing the page
					</p>
					<button
						type="button"
						onClick={() => window.location.reload()}
						className="px-4 py-2 text-xs font-medium rounded-lg bg-surface-elevated border border-border hover:border-accent/50 transition-colors"
					>
						Refresh page
					</button>
				</div>
			}
		>
			<Suspense fallback={<ChatLoadingFallback />}>
				<LiveModelsProvider>
					<ChatPlaygroundShell
						variant="chat"
						storageKey="oma_chat_conversation"
						systemPromptKey="oma_chat_system_prompt"
					/>
				</LiveModelsProvider>
			</Suspense>
		</ErrorBoundary>
	);
}
