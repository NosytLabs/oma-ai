"use client";

import { AlertTriangle } from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { ChatPlaygroundShell } from "./_components/ChatPlaygroundShell";

function ChatLoadingFallback() {
	return (
		<div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
			<div className="animate-pulse space-y-4">
				<div className="h-8 w-48 bg-surface-elevated rounded" />
				<div className="h-20 w-full max-w-2xl bg-surface-elevated rounded" />
				<div className="h-16 w-full max-w-2xl bg-surface-elevated rounded" />
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
				<ChatPlaygroundShell
					variant="chat"
					storageKey="oma_chat_conversation"
					systemPromptKey="oma_chat_system_prompt"
				/>
			</Suspense>
		</ErrorBoundary>
	);
}
