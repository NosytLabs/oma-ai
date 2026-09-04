/**
	* ModelLogo — real brand logos sourced from homarr-labs/dashboard-icons.
	*
	* Loads authentic brand SVGs from `/logos/providers/{slug}.svg` (locally
	* vendored from https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/,
	* MIT licensed). Falls back to a styled initials badge when no icon
	* resolves. All OMA-AI resale models collapse to the oma-ai tile.
	*
	* NOTE: local static SVGs render via plain <img> (with an onError stage
	* fallback). Next's Image optimizer cannot optimize SVGs, these tiles are
	* tiny (≤20px) and already `loading="lazy"` + `decoding="async"`, so
	* next/image adds no LCP/bandwidth win here — only layout ceremony.
	*/
/* eslint-disable @next/next/no-img-element */
import { useState, type CSSProperties } from "react";

// Map model provider → locally-vendored dashboard-icons SVG filename.
// These files live in /public/logos/providers/ and are mirrored from the
// upstream homarr-labs/dashboard-icons repo (MIT licensed). The `grok`
// slug is what dashboard-icons uses for xAI (no `xai` entry exists upstream).
// Slugs follow the canonical upstream names — using the wrong slug returns
// 404 and falls back to the hand-tuned local tile (Venice, Mercury, Coinbase,
// Gonka) — see /public/logos/providers/README.md.
const DASHBOARD_ICON_SLUGS: Record<string, string> = {
	openai: "openai",
	anthropic: "anthropic",
	claude: "anthropic",
	google: "google",
	gemma: "google",
	gemini: "google-gemini",
	meta: "meta",
	llama: "meta",
	deepseek: "deepseek",
	mistral: "mistral-ai",
	xai: "grok",
	grok: "grok",
	moonshotai: "kimi-ai",
	kimi: "kimi-ai",
	// Alibaba assets are not vendored; use the model initials fallback rather
	// than requesting a missing SVG from the browser.
	qwen: "qwen",
	minimax: "minimax",
	xiaomi: "xiaomi-global",
	mimo: "xiaomi-global",
	zhipuai: "z-ai",
	zai: "z-ai",
	glm: "z-ai",
	ethereum: "ethereum",
	coinbase: "coinbase",
};

interface ModelLogoProps {
	/** Model ID or provider name — used to resolve the brand icon. */
	modelId: string;
	/** Display size in px (default 20). */
	size?: number;
	/** Optional CSS class. */
	className?: string;
}

function getProviderFromModelId(modelId: string): string {
	const lower = modelId.toLowerCase();
	if (lower.includes("openai") || lower.includes("gpt")) return "openai";
	if (lower.includes("claude") || lower.includes("anthropic")) return "anthropic";
	if (lower.includes("gemini")) return "gemini";
	if (lower.includes("llama") || lower.includes("meta")) return "meta";
	if (lower.includes("deepseek")) return "deepseek";
	if (lower.includes("mistral")) return "mistral";
	if (lower.includes("gemma")) return "google";
	if (lower.includes("grok") || lower.includes("xai")) return "xai";
	if (lower.includes("kimi") || lower.includes("moonshot")) return "moonshotai";
	if (lower.includes("qwen")) return "qwen";
	if (lower.includes("minimax")) return "minimax";
	if (lower.includes("xiaomi") || lower.includes("mimo")) return "xiaomi";
	if (lower.includes("glm") || lower.includes("zhipu") || lower.includes("z-ai")) return "zai";
	if (lower.includes("mercury") || lower.includes("inception")) return "mercury";
	if (lower.includes("venice")) return "venice";
	if (lower.includes("usdc") || lower.includes("usd-coin")) return "usdcoin";
	if (lower.includes("ethereum") || lower.includes("eth")) return "ethereum";
	if (lower.includes("base") || lower.includes("coinbase")) return "coinbase";
	if (lower.includes("oma-ai") || lower.includes("oma")) return "oma-ai";
	return "";
}

function getInitials(modelId: string): string {
	const parts = modelId
		.replace(/^(openai-|claude-|zai-org-|google-|venice-|mercury-)/, "")
		.split(/[-_]/);
	if (parts.length >= 2) {
		return (parts[0][0] + parts[1][0]).toUpperCase();
	}
	return modelId.slice(0, 2).toUpperCase();
}

// Providers without a dashboard-icons entry — fall back to local tile.
const LOCAL_FALLBACKS: Record<string, string> = {
	mercury: "/logos/providers/mercury.svg",
	inception: "/logos/providers/mercury.svg",
	inceptionai: "/logos/providers/mercury.svg",
	venice: "/logos/providers/venice.svg",
	coinbase: "/logos/providers/coinbase.svg",
	"oma-ai": "/logos/providers/gonka.svg",
	gonka: "/logos/providers/gonka.svg",
};

// Colors for the initials fallback when no icon resolves.
const FALLBACK_COLORS: Record<string, string> = {
	openai: "#10a37f",
	anthropic: "#d4a574",
	google: "#4285f4",
	gemini: "#4285f4",
	meta: "#0668e1",
	deepseek: "#4d6bfe",
	mistral: "#ff7000",
	xai: "#1d9bf0",
	moonshotai: "#6366f1",
	alibabacloud: "#ff6a00",
	minimax: "#e11d48",
	xiaomi: "#ff6900",
	zhipuai: "#818cf8",
	zai: "#818cf8",
	mercury: "#3b82f6",
	venice: "#8b5cf6",
	coinbase: "#0052ff",
	"oma-ai": "#22d3ee",
};

export function ModelLogo({
	modelId,
	size = 20,
	className = "",
}: ModelLogoProps) {
	const [errorStage, setErrorStage] = useState<"none" | "local">(
		"none",
	);

	const provider = getProviderFromModelId(modelId);
	const cdnSlug = provider ? DASHBOARD_ICON_SLUGS[provider] : undefined;
	const localSrc = provider ? LOCAL_FALLBACKS[provider] : undefined;
	const color = FALLBACK_COLORS[provider] ?? "#6366f1";

	// 1) Try local vendored dashboard-icons tile first (authentic brand
	// colors, no network round-trip, MIT-licensed).
	if (cdnSlug && errorStage === "none") {
		const url = `/logos/providers/${cdnSlug}.svg`;
		return (
			<img
				src={url}
				alt=""
				width={size}
				height={size}
				className={`model-logo-svg shrink-0 rounded-[var(--radius-sm)] ${className}`}
				style={{ "--ml-size": `${size}px` } as CSSProperties}
				onError={() => setErrorStage("local")}
				loading="lazy"
				decoding="async"
			/>
		);
	}

	// 2) Try local tile (for providers not in dashboard-icons catalog)
	if (localSrc) {
		return (
			<img
				src={localSrc}
				alt=""
				width={size}
				height={size}
				className={`model-logo-svg inline-block shrink-0 rounded-[var(--radius-sm)] ${className}`}
				style={{ "--ml-size": `${size}px` } as CSSProperties}
				loading="lazy"
				decoding="async"
			/>
		);
	}

	// 3) Initials badge fallback
	const initials = getInitials(modelId);
	const bgColor = `${color}20`;
	const lighten = (hex: string, amount: number): string => {
		const n = parseInt(hex.slice(1), 16);
		const mix = (c: number) => Math.round(c + (255 - c) * amount);
		const h = (v: number) => v.toString(16).padStart(2, "0");
		return `#${h(mix((n >> 16) & 0xff))}${h(mix((n >> 8) & 0xff))}${h(mix(n & 0xff))}`;
	};
	const textColor = lighten(color, 0.35);

	return (
		<span
			className={`inline-flex items-center justify-center shrink-0 font-mono font-bold ${className}`}
			style={{
				width: size,
				height: size,
				borderRadius: size * 0.22,
				backgroundColor: bgColor,
				color: textColor,
				fontSize: size * 0.38,
				lineHeight: 1,
			}}
			aria-hidden="true"
		>
			{initials}
		</span>
	);
}
