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
//
// Only providers whose local SVG is verified to render cleanly at the card
// tile size (36×36, with viewBox=0 0 24 24 or similar tight box) are
// mapped here. Providers whose vendored SVG ships with an off-canvas
// viewBox (kimi-ai.svg: viewBox starts at (2589, 529); xiaomi-global.svg:
// viewBox starts at (-200, -199); meta.svg/ethereum.svg: no viewBox at
// all; google-gemini.svg: root fill="none") render as an empty square
// inside the ModelCard. Rather than serving an invisible logo, those
// providers fall through to the colored initials badge below.
const DASHBOARD_ICON_SLUGS: Record<string, string> = {
	openai: "openai",
	anthropic: "anthropic",
	claude: "anthropic",
	google: "google",
	gemma: "google",
	gemini: "google-gemini",
	// meta + llama: dropped — meta.svg ships with no viewBox attribute,
	// so the browser renders it at the intrinsic 300×150 default and the
	// card shows a stretched/blank tile. Initials badge wins.
	// meta: "meta",
	// llama: "meta",
	deepseek: "deepseek",
	mistral: "mistral-ai",
	// xAI / grok.svg root fill="none" + per-path CSS classes at opacity
	// 0.3 and 0.8; at 36×36 the rendered shape disappears into the panel
	// background. Drop xai mapping (grok mapping was already dropped above).
	// xai: "grok",
	// moonshotai + kimi: kimi-ai.svg ships with viewBox "2589.93 529.3
	// 4225.03 4225.03" — the logo content sits in the corner of a
	// 4225px canvas and renders ~0 visible px after scaling to 36px.
	// Drop to initials badge.
	// moonshotai: "kimi-ai",
	// kimi: "kimi-ai",
	// Alibaba assets are not vendored; use the model initials fallback rather
	// than requesting a missing SVG from the browser.
	// qwen.svg viewBox offsets the logo to (27.55, 17.52) inside a 147×145
	// canvas — at 36×36 the visible logo collapses to a few non-visible
	// sub-px. Drop to initials.
	// qwen: "qwen",
	// minimax.svg: chromium-headless returns naturalW: 0 when rendering
	// the file via <img>, even though a raw `fetch()` of the URL returns
	// the full SVG body (verified live). Visible-MiniMax cards have
	// always rendered as a blank tile on the live site. Drop to initials.
	// minimax: "minimax",
	// xiaomi + mimo: xiaomi-global.svg ships with viewBox "-200.008 -199.727
	// 512 512" — the visible mark sits in the negative coord space and
	// vanishes when scaled to 36×36. Drop to initials.
	// xiaomi: "xiaomi-global",
	// mimo: "xiaomi-global",
	zhipuai: "z-ai",
	zai: "z-ai",
	glm: "z-ai",
	// ethereum.svg ships with no viewBox attribute at all and an
	// unwrapped <path> that fills the entire image bounding box. At
	// 36×36 it shows as a stretched-blank diamond. Drop to initials.
	// ethereum: "ethereum",
	coinbase: "coinbase",
	// venice: same chromium-headless naturalW: 0 issue as minimax above.
	// The LogoPath card showed a blank tile for Venice Uncensored 1.2
	// since launch; better to render the violet "VU" initials badge.
	// venice: "venice" (resolved via LOCAL_FALLBACKS, but the SVG fails to
	// decode in chromium-headless <img> as well), so no mapping here:
	// `getProviderFromModelId("venice-...")` returns "venice" with no slug
	// in this map and no localFallback either, falling through to
	// initials.
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

function lighten(hex: string, amount: number): string {
	const n = parseInt(hex.slice(1), 16);
	const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
	const toHex = (value: number) => value.toString(16).padStart(2, "0");
	const red = toHex(mix((n >> 16) & 255));
	const green = toHex(mix((n >> 8) & 255));
	const blue = toHex(mix(n & 255));
	return `#${red}${green}${blue}`;
}

// Providers without a dashboard-icons entry fall back to local tile.
const LOCAL_FALLBACKS: Record<string, string> = {
	mercury: "/logos/providers/mercury.svg",
	inception: "/logos/providers/mercury.svg",
	inceptionai: "/logos/providers/mercury.svg",
	// venice: venice.svg has the chromium-headless naturalW: 0 issue
	// described on the DASHBOARD_ICON_SLUGS table; falling through to
	// initials is preferable to serving a blank tile. gonka/OMA-AI and
	// coinbase have working local tiles and remain.
	// venice: "/logos/providers/venice.svg",
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
