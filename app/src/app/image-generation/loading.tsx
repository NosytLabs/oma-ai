"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { ThinkingOrb } from "thinking-orbs";

export default function Loading() {
	return (
		<div
			role="status"
			aria-label="Loading image generation"
			className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 animate-pulse"
		>
			<Skeleton className="h-3 w-24 mb-3" />
			<Skeleton className="h-10 w-72 mb-3" />
			<Skeleton className="h-4 w-1/2 mb-8" />
			<div className="mb-6 flex items-center gap-3 text-xs font-mono text-text-muted">
				<ThinkingOrb state="shaping" size={20} theme="auto" aria-label="Shaping generated image" />
				<span>shaping your image</span>
			</div>
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
				<div className="rounded-2xl border border-border/50 bg-surface p-6 space-y-3">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-32 w-full" />
					<Skeleton className="h-3 w-3/4" />
				</div>
				<div className="rounded-2xl border border-border/50 bg-surface p-6 space-y-3">
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-12 w-full" />
				</div>
			</div>
		</div>
	);
}
