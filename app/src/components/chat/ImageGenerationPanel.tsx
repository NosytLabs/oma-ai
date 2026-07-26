"use client";

import {
	Download,
	Image as ImageIconComponent,
	Loader2,
	Plus,
	Sparkles,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";
import { useImageGeneration } from "@/lib/use-image-generation";

const IMAGE_MODELS = [
	{ id: "sdxl", name: "SDXL" },
	{ id: "flux-schnell", name: "Flux Schnell" },
	{ id: "flux-pro", name: "Flux Pro" },
	{ id: "stable-diffusion-3.5", name: "Stable Diffusion 3.5" },
];

const SIZE_OPTIONS = [
	{ label: "Square", value: "1024x1024" },
	{ label: "Portrait", value: "1024x1536" },
	{ label: "Landscape", value: "1536x1024" },
	{ label: "Small Square", value: "512x512" },
];

const STYLE_OPTIONS = [
	{ label: "Realistic", value: "realistic" },
	{ label: "Illustration", value: "illustration" },
	{ label: "3D", value: "3d" },
	{ label: "Anime", value: "anime" },
] as const;

const CREDITS_PER_IMAGE = 5;
const USD_PER_CREDIT = 0.0025;

export function ImageGenerationPanel() {
	const [prompt, setPrompt] = useState("");
	const [model, setModel] = useState("sdxl");
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

	const downloadImage = useCallback(
		async (url: string, index: number) => {
			try {
				const resp = await fetch(url);
				const blob = await resp.blob();
				const a = document.createElement("a");
				a.href = URL.createObjectURL(blob);
				a.download = `oma-image-${Date.now()}-${index + 1}.png`;
				a.click();
				URL.revokeObjectURL(a.href);
			} catch {
				// Download failure is non-fatal; the user can still right-click
				// the image. We log to the console so the failure is visible
				// in dev tools without a noisy toast.
				console.error("Image download failed");
			}
		},
		[],
	);

	return (
		<div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
			<div className="mb-8">
				<div className="mb-2 text-sm font-medium text-accent">
					OMA AI Gateway
				</div>
				<h1 className="h1-utility text-text-bright">Image Generation</h1>
				<p className="mt-3 text-lg text-text-bright">
					Generate images from text prompts. Powered by Venice AI.{" "}
					<span className="text-accent">{CREDITS_PER_IMAGE} credits</span>
					<span className="text-text-muted">
						{" "}
						(${(CREDITS_PER_IMAGE * USD_PER_CREDIT).toFixed(3)} USD)
					</span>{" "}
					per image.
				</p>
			</div>

			<div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
				<div className="grid gap-6 lg:grid-cols-3">
					<div className="lg:col-span-2 space-y-4">
						<div>
							<label
								htmlFor="prompt-input"
								className="mb-2 block text-sm font-semibold text-text-bright"
							>
								Prompt
							</label>
							<textarea
								id="prompt-input"
								value={prompt}
								onChange={(e) => setPrompt(e.target.value)}
								placeholder="A serene mountain lake at sunset, digital art..."
								rows={4}
								disabled={loading}
								aria-required="true"
								className="w-full resize-none text-text-bright placeholder:text-text-muted"
							/>
						</div>
					</div>

					<div className="space-y-4">
						<div>
							<label
								htmlFor="img-model-select"
								className="mb-2 block text-sm font-semibold text-text-bright"
							>
								Model
							</label>
							<select
								id="img-model-select"
								value={model}
								onChange={(e) => setModel(e.target.value)}
								disabled={loading}
								className="w-full disabled:opacity-50"
							>
								{IMAGE_MODELS.map((m) => (
									<option key={m.id} value={m.id}>
										{m.name}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="mb-2 block text-sm font-semibold text-text-bright">
								Style
							</label>
							<div className="grid grid-cols-2 gap-1.5">
								{STYLE_OPTIONS.map((s) => (
									<button
										key={s.value}
										type="button"
										onClick={() => setStyle(style === s.value ? "" : s.value)}
										aria-pressed={style === s.value}
										className={`px-2.5 py-2 text-xs font-mono rounded-lg border transition-all ${
											style === s.value
												? "border-accent bg-accent/10 text-accent"
												: "border-border bg-surface text-text-secondary hover:border-accent/40 hover:text-text"
										}`}
									>
										{s.label}
									</button>
								))}
							</div>
						</div>

						<div>
							<label
								htmlFor="img-size-select"
								className="mb-2 block text-sm font-semibold text-text-bright"
							>
								Size
							</label>
							<select
								id="img-size-select"
								value={size}
								onChange={(e) => setSize(e.target.value)}
								disabled={loading}
								className="w-full disabled:opacity-50"
							>
								{SIZE_OPTIONS.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label} ({o.value})
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="mb-2 block text-sm font-semibold text-text-bright">
								Count
							</label>
							<div
								className="flex items-center gap-2"
								role="toolbar"
								aria-label="Number of images to generate"
							>
								{[1, 2, 3, 4].map((n) => (
									<button
										type="button"
										key={n}
										onClick={() => setCount(n)}
										disabled={loading}
										aria-pressed={count === n}
										className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
											count === n
												? "bg-accent text-void shadow-md"
												: "bg-surface text-text hover:bg-border"
										}`}
									>
										{n}
									</button>
								))}
							</div>
						</div>
					</div>
				</div>

				<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
					<button
						type="button"
						onClick={onGenerate}
						disabled={!prompt.trim() || loading}
						className="btn-primary w-full sm:w-auto justify-center"
						aria-label={
							loading
								? "Generating images, please wait"
								: "Generate images from prompt"
						}
					>
						{loading ? (
							<>
								<Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />{" "}
								Generating...
							</>
						) : (
							<>
								<Sparkles className="w-5 h-5" aria-hidden="true" /> Generate
							</>
						)}
					</button>
					{images.length > 0 && (
						<button
							type="button"
							onClick={() => {
								setImages([]);
								setPrompt("");
								setError(null);
							}}
							className="btn-secondary w-full sm:w-auto justify-center"
							aria-label="Create new image generation"
						>
							<Plus className="w-4 h-4" aria-hidden="true" /> New
						</button>
					)}
				</div>

				{error && (
					<div
						className="mt-4 rounded-xl border px-4 py-3 text-sm border-error bg-error/10 text-error"
						role="alert"
					>
						{error}
					</div>
				)}
			</div>

			{loading && (
				<div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
					{Array.from({ length: count }).map((_, i) => (
						<div key={i} className="aspect-square rounded-2xl animate-shimmer bg-surface-elevated" />
					))}
				</div>
			)}

			{images.length > 0 && !loading && (
				<div className="mt-8">
					<h2 className="mb-4 text-lg font-semibold text-text-bright">
						Results
					</h2>
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
						{images.map((url, i) => (
							<div
								key={i}
								className="group relative rounded-2xl overflow-hidden border border-border bg-surface shadow-sm aspect-square"
							>
								<Image
									src={url}
									alt={`Generated image ${i + 1} of ${images.length}`}
									fill
									className="object-cover"
									unoptimized
								/>
								<div className="absolute inset-0 bg-transparent group-hover:bg-overlay transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
									<button
										type="button"
										onClick={() => downloadImage(url, i)}
										className="flex items-center gap-2 rounded-full bg-surface px-5 py-2.5 text-sm font-semibold text-text shadow-lg hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 transition-all"
										aria-label={`Download generated image ${i + 1}`}
									>
										<Download className="w-4 h-4" aria-hidden="true" /> Download
									</button>
								</div>
								<div className="absolute bottom-3 right-3 opacity-100 group-hover:opacity-100">
									<button
										type="button"
										onClick={() => downloadImage(url, i)}
										className="flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1.5 text-xs font-medium text-text shadow-md backdrop-blur-sm hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent transition-all"
										aria-label={`Download generated image ${i + 1}`}
									>
										<Download className="w-3.5 h-3.5" aria-hidden="true" />
									</button>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{!loading && images.length === 0 && !error && (
				<div className="mt-16 flex flex-col items-center justify-center text-center">
					<div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center mb-6 shadow-xl">
						<ImageIconComponent className="w-10 h-10 text-text-inverse" />
					</div>
					<h2 className="h2-page text-text-bright mb-2">
						Describe what you want to see
					</h2>
					<p className="text-text max-w-md">
						Enter a detailed prompt above and click Generate. Try including
						style, lighting, and composition details.
					</p>
				</div>
			)}
		</div>
	);
}
