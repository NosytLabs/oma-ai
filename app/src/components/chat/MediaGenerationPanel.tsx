"use client";

/**
 * Unified Create studio for image + video generation inside /chat.
 *
 * Venice/OpenRouter-style: one creative surface with an Image | Video
 * toggle, instead of two disconnected full-page panels.
 */

import { Film, Image as ImageIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";

const LazyImageGenerationPanel = dynamic(
	() =>
		import("@/components/chat/ImageGenerationPanel").then(
			(m) => m.ImageGenerationPanel,
		),
	{ ssr: false, loading: () => <Skeleton className="h-96 w-full" /> },
);

const LazyVideoGenerationPanel = dynamic(
	() =>
		import("@/components/chat/VideoGenerationPanel").then(
			(m) => m.VideoGenerationPanel,
		),
	{ ssr: false, loading: () => <Skeleton className="h-96 w-full" /> },
);

export type MediaKind = "image" | "video";

interface MediaGenerationPanelProps {
	kind: MediaKind;
	onKindChange: (kind: MediaKind) => void;
}

export function MediaGenerationPanel({
	kind,
	onKindChange,
}: MediaGenerationPanelProps) {
	// max-w-4xl matches chat column + composer so Create doesn't jump wider
	return (
		<div className="mx-auto flex h-full w-full max-w-4xl flex-col">
			{/* Unified Create chrome */}
			<div className="mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-4">
				<div>
					<p className="text-[11px] font-mono uppercase tracking-widest text-accent">
						Create · multimodal
					</p>
					<h2 className="text-lg font-semibold text-text-bright sm:text-xl">
						{kind === "image" ? "Image generation" : "Video generation"}
					</h2>
					<p className="mt-0.5 text-xs text-text-muted">
						One studio for stills and motion — billed in credits.
					</p>
				</div>

				<div
					className="inline-flex items-center gap-0.5 rounded-[var(--radius-md)] border border-border bg-surface p-0.5"
					role="tablist"
					aria-label="Create media type"
				>
					<button
						type="button"
						role="tab"
						aria-selected={kind === "image"}
						onClick={() => onKindChange("image")}
						className={`inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-md)] px-3 text-xs font-medium transition-[background-color,color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
							kind === "image"
								? "bg-accent/15 text-accent"
								: "text-text-secondary hover:text-text-bright"
						}`}
					>
						<ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
						Image
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={kind === "video"}
						onClick={() => onKindChange("video")}
						className={`inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-md)] px-3 text-xs font-medium transition-[background-color,color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
							kind === "video"
								? "bg-accent/15 text-accent"
								: "text-text-secondary hover:text-text-bright"
						}`}
					>
						<Film className="h-3.5 w-3.5" aria-hidden="true" />
						Video
					</button>
				</div>
			</div>

			{/* Existing panels keep their generate/API logic; strip their
			    outer page chrome by rendering inside this shell. */}
			<div className="min-h-0 flex-1 overflow-y-auto">
				{kind === "image" ? (
					<LazyImageGenerationPanel embedded />
				) : (
					<LazyVideoGenerationPanel embedded />
				)}
			</div>
		</div>
	);
}
