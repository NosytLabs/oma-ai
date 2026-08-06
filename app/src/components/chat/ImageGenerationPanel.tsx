"use client";

/**
 * Image generation panel — embedded in /chat?mode=image.
 * Compact, mobile-first layout (not a standalone marketing page).
 */

import {
	Download,
	Image as ImageIconComponent,
	RefreshCw,
	Sparkles,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";
import { ThinkingOrb } from "thinking-orbs";
import { useImageGeneration } from "@/lib/use-image-generation";

const IMAGE_MODELS = [
	{ id: "venice-sd35", name: "Venice SD35" },
	{ id: "flux-2-pro", name: "Flux 2 Pro" },
	{ id: "flux-2-max", name: "Flux 2 Max" },
	{ id: "gpt-image-1-5", name: "GPT Image 1.5" },
	{ id: "hunyuan-image-v3", name: "Hunyuan Image 3.0" },
	{ id: "ideogram-v4", name: "Ideogram V4" },
	{ id: "imagineart-1.5-pro", name: "ImagineArt 1.5 Pro" },
	{ id: "krea-v2-large", name: "Krea v2 Large" },
	{ id: "krea-v2-medium", name: "Krea v2 Medium" },
	{ id: "luma-uni-1", name: "Luma Uni-1" },
	{ id: "luma-uni-1-max", name: "Luma Uni-1 Max" },
	{ id: "nano-banana-2-lite", name: "Nano Banana 2 Lite" },
	{ id: "recraft-v4", name: "Recraft V4" },
	{ id: "recraft-v4-pro", name: "Recraft V4 Pro" },
	{ id: "seedream-v4", name: "Seedream V4.5" },
	{ id: "seedream-v5-lite", name: "Seedream V5 Lite" },
	{ id: "qwen-image-2", name: "Qwen Image 2" },
	{ id: "qwen-image-2-pro", name: "Qwen Image 2 Pro" },
	{ id: "wan-2-7-text-to-image", name: "Wan 2.7" },
	{ id: "wan-2-7-pro-text-to-image", name: "Wan 2.7 Pro" },
	{ id: "qwen-image", name: "Qwen Image" },
	{ id: "wai-Illustrious", name: "Anime (WAI)" },
	{ id: "z-image-turbo", name: "Z-Image Turbo" },
	{ id: "chroma", name: "Chroma" },
	{ id: "bria-bg-remover", name: "Background Remover" },
];

const SIZE_OPTIONS = [
	{ label: "Square", value: "1024x1024" },
	{ label: "Portrait", value: "1024x1536" },
	{ label: "Landscape", value: "1536x1024" },
	{ label: "Small", value: "512x512" },
];

const STYLE_OPTIONS = [
	{ label: "Realistic", value: "realistic" },
	{ label: "Illustration", value: "illustration" },
	{ label: "3D", value: "3d" },
	{ label: "Anime", value: "anime" },
] as const;

const CREDITS_PER_IMAGE = 10;
const USD_PER_CREDIT = 0.01;

export function ImageGenerationPanel() {
	const [prompt, setPrompt] = useState("");
	const [model, setModel] = useState("venice-sd35");
	const [size, setSize] = useState("1024x1024");
	const [style, setStyle] = useState<string>("");
	const [count, setCount] = useState(1);
	const [images, setImages] = useState<string[]>([]);
	const { generate, loading, error, setError } = useImageGeneration();

	const onGenerate = useCallback(async () => {
		if (!prompt.trim() || loading) return;
		setImages([]);
		const result = await generate({
			model,
			prompt,
			count,
			size,
			style: style || null,
		});
		if (result) setImages(result.urls);
	}, [prompt, model, count, size, style, loading, generate]);

	const onRetry = useCallback(() => {
		setError(null);
		void onGenerate();
	}, [onGenerate, setError]);

	const downloadImage = useCallback(async (url: string, index: number) => {
		try {
			const resp = await fetch(url);
			const blob = await resp.blob();
			const a = document.createElement("a");
			a.href = URL.createObjectURL(blob);
			a.download = `oma-image-${Date.now()}-${index + 1}.png`;
			a.click();
			URL.revokeObjectURL(a.href);
		} catch {
			console.error("Image download failed");
		}
	}, []);

	const costCredits = CREDITS_PER_IMAGE * count;

	return (
		<div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-y-auto px-3 py-4 sm:px-5 sm:py-6">
			{/* Compact header for chat shell */}
			<div className="mb-4 flex flex-wrap items-end justify-between gap-2">
				<div>
					<p className="text-[11px] font-mono uppercase tracking-widest text-accent">
						Image · Venice
					</p>
					<h1 className="text-lg font-semibold text-text-bright sm:text-xl">
						Image generation
					</h1>
				</div>
				<p className="text-xs text-text-muted font-mono">
					<span className="text-accent">{costCredits} cr</span>
					{" · "}
					${(costCredits * USD_PER_CREDIT).toFixed(3)}
				</p>
			</div>

			<div className="rounded-xl border border-border bg-surface/80 p-3 sm:p-4">
				<div className="grid gap-4 lg:grid-cols-5">
					{/* Prompt */}
					<div className="lg:col-span-3 space-y-2">
						<label
							htmlFor="prompt-input"
							className="block text-xs font-semibold uppercase tracking-wide text-text-muted"
						>
							Prompt
						</label>
						<textarea
							id="prompt-input"
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							placeholder="A serene mountain lake at sunset, digital art…"
							rows={4}
							disabled={loading}
							aria-required="true"
							className="w-full min-h-[96px] resize-y rounded-lg border border-border bg-void px-3 py-2.5 text-[15px] text-text-bright placeholder:text-text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 disabled:opacity-50"
						/>
					</div>

					{/* Controls */}
					<div className="lg:col-span-2 space-y-3">
						<div>
							<label
								htmlFor="img-model-select"
								className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted"
							>
								Model
							</label>
							<select
								id="img-model-select"
								value={model}
								onChange={(e) => setModel(e.target.value)}
								disabled={loading}
								className="w-full rounded-lg border border-border bg-void px-3 py-2.5 text-sm text-text-bright disabled:opacity-50"
							>
								{IMAGE_MODELS.map((m) => (
									<option key={m.id} value={m.id}>
										{m.name}
									</option>
								))}
							</select>
						</div>

						<div>
							<span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
								Style
							</span>
							<div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-2">
								{STYLE_OPTIONS.map((s) => (
									<button
										key={s.value}
										type="button"
										onClick={() => setStyle(style === s.value ? "" : s.value)}
										aria-pressed={style === s.value}
										className={`min-h-[40px] rounded-lg border px-2 py-2 text-xs font-mono transition-[background-color,border-color,color] duration-150 ease-out active:scale-[0.97] ${
											style === s.value
												? "border-accent bg-accent/10 text-accent"
												: "border-border bg-void text-text-secondary hover:border-accent/40"
										}`}
									>
										{s.label}
									</button>
								))}
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div>
								<label
									htmlFor="img-size-select"
									className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted"
								>
									Size
								</label>
								<select
									id="img-size-select"
									value={size}
									onChange={(e) => setSize(e.target.value)}
									disabled={loading}
									className="w-full rounded-lg border border-border bg-void px-2 py-2.5 text-sm text-text-bright disabled:opacity-50"
								>
									{SIZE_OPTIONS.map((o) => (
										<option key={o.value} value={o.value}>
											{o.label}
										</option>
									))}
								</select>
							</div>
							<div>
								<span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
									Count
								</span>
								<div
									className="flex gap-1"
									role="toolbar"
									aria-label="Number of images"
								>
									{[1, 2, 3, 4].map((n) => (
										<button
											type="button"
											key={n}
											onClick={() => setCount(n)}
											disabled={loading}
											aria-pressed={count === n}
											className={`min-h-[40px] flex-1 rounded-lg text-sm font-semibold transition-[background-color,border-color,color] duration-150 ease-out active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-accent ${
												count === n
													? "bg-accent text-void"
													: "bg-void border border-border text-text hover:border-accent/40"
											}`}
										>
											{n}
										</button>
									))}
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Actions */}
				<div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
					<button
						type="button"
						onClick={onGenerate}
						disabled={!prompt.trim() || loading}
						className="btn-primary inline-flex min-h-[44px] w-full items-center justify-center gap-2 sm:w-auto"
						aria-label={
							loading ? "Generating images, please wait" : "Generate images"
						}
					>
						{loading ? (
							<>
								<ThinkingOrb
									state="shaping"
									size={20}
									theme="auto"
									aria-hidden="true"
								/>
								Generating…
							</>
						) : (
							<>
								<Sparkles className="h-4 w-4" aria-hidden="true" />
								Generate
							</>
						)}
					</button>
					{(error || images.length > 0) && !loading && (
						<button
							type="button"
							onClick={onRetry}
							disabled={!prompt.trim()}
							className="btn-secondary inline-flex min-h-[44px] w-full items-center justify-center gap-2 sm:w-auto"
							aria-label="Retry image generation"
						>
							<RefreshCw className="h-4 w-4" aria-hidden="true" />
							{error ? "Retry" : "Regenerate"}
						</button>
					)}
					{images.length > 0 && !loading && (
						<button
							type="button"
							onClick={() => {
								setImages([]);
								setError(null);
							}}
							className="btn-secondary inline-flex min-h-[44px] w-full items-center justify-center gap-2 sm:w-auto"
						>
							Clear results
						</button>
					)}
				</div>

				{error && (
					<div
						className="mt-3 rounded-lg border border-error/40 bg-error/10 px-3 py-2.5 text-sm text-error"
						role="alert"
					>
						{error}
					</div>
				)}
			</div>

			{/* Loading skeletons + orb */}
			{loading && (
				<div className="mt-6">
					<div
						className="mb-4 flex items-center justify-center gap-3 text-sm text-text-muted"
						role="status"
						aria-live="polite"
					>
						<ThinkingOrb
							state="shaping"
							size={64}
							theme="auto"
							aria-hidden="true"
						/>
						<span className="font-mono text-xs uppercase tracking-widest">
							Shaping image…
						</span>
					</div>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						{Array.from({ length: count }).map((_, i) => (
							<div
								key={i}
								className="aspect-square animate-shimmer rounded-xl bg-surface-elevated"
							/>
						))}
					</div>
				</div>
			)}

			{/* Results — downloads always visible on touch (not hover-only) */}
			{images.length > 0 && !loading && (
				<div className="mt-6">
					<h2 className="mb-3 text-sm font-semibold text-text-bright">
						Results ({images.length})
					</h2>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						{images.map((url, i) => (
							<div
								key={i}
								className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-surface"
							>
								<Image
									src={url}
									alt={`Generated image ${i + 1} of ${images.length}`}
									fill
									className="object-cover"
									unoptimized
								/>
								<button
									type="button"
									onClick={() => downloadImage(url, i)}
									className="absolute bottom-2 right-2 flex min-h-[40px] items-center gap-1.5 rounded-full bg-surface/95 px-3 py-2 text-xs font-medium text-text shadow-md backdrop-blur-sm hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent sm:opacity-90"
									aria-label={`Download generated image ${i + 1}`}
								>
									<Download className="h-3.5 w-3.5" aria-hidden="true" />
									Download
								</button>
							</div>
						))}
					</div>
				</div>
			)}

			{!loading && images.length === 0 && !error && (
				<div className="mt-10 flex flex-col items-center justify-center px-4 text-center">
					<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
						<ImageIconComponent className="h-7 w-7" />
					</div>
					<p className="max-w-sm text-sm text-text-muted">
						Describe a scene above, pick a model, then Generate. Include style,
						lighting, and composition for better results.
					</p>
				</div>
			)}
		</div>
	);
}
