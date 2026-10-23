/**
 * Provider logos load from local SVGs, with additional local tiles or initials
 * as fallbacks. See public/logos/providers/README.md.
 */
/* eslint-disable @next/next/no-img-element */
import { useState, type CSSProperties } from "react";

// Provider names mapped to local dashboard-icons filenames.
const DASHBOARD_ICON_SLUGS: Record<string, string> = {
	openai: "openai",
	anthropic: "anthropic",
	claude: "anthropic",
	google: "google",
	gemma: "google",
	gemini: "google-gemini",
	deepseek: "deepseek",
	mistral: "mistral-ai",
	zhipuai: "z-ai",
	zai: "z-ai",
	glm: "z-ai",
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

function lighten(hex: string, amount: number): string {
	const n = parseInt(hex.slice(1), 16);
	const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
	const toHex = (value: number) => value.toString(16).padStart(2, "0");
	const red = toHex(mix((n >> 16) & 255));
	const green = toHex(mix((n >> 8) & 255));
	const blue = toHex(mix(n & 255));
	return `#${red}${green}${blue}`;
}

// Additional local tiles.
const LOCAL_FALLBACKS: Record<string, string> = {
	mercury: "/logos/providers/mercury.svg",
	inception: "/logos/providers/mercury.svg",
	inceptionai: "/logos/providers/mercury.svg",
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
	const iconSlug = provider ? DASHBOARD_ICON_SLUGS[provider] : undefined;
	const localSrc = provider ? LOCAL_FALLBACKS[provider] : undefined;
	const color = FALLBACK_COLORS[provider] ?? "#6366f1";

	// Try the mapped local dashboard-icons tile first.
	if (iconSlug && errorStage === "none") {
		const url = `/logos/providers/${iconSlug}.svg`;
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
