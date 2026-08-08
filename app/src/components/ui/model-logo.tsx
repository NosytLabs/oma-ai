/**
 * ModelLogo — real brand logos for AI models via SimpleIcons CDN.
 *
 * Uses https://cdn.simpleicons.org/{slug} for brand-accurate SVGs.
 * Falls back to a styled initials badge when no CDN icon exists.
 *
 * SimpleIcons is MIT-licensed with 3000+ brand icons — all fill-based
 * SVGs that accept color via the URL path (no CSS needed).
 */
import { useState, type CSSProperties } from "react";

// Slugs that have been observed returning 404 from
// https://cdn.simpleicons.org. Skipped to avoid network noise + console
// errors. Add new entries here when an upstream brand renames.
// (Verified 2026-07-31: openai/zhipuai/zai/mistral/inceptionai 404 on the
// CDN; everything else in LOGO_MAP resolves to a real brand icon.)
// Prefer local tiles for these — SimpleIcons 404s or we want offline paint.
const KNOWN_MISSING_SLUGS = new Set<string>([
 "zhipuai",
 "zai",
 "openai",
 "mistral",
 "inceptionai",
 "inception",
 "anthropic",
 "google",
 "meta",
 "deepseek",
 "moonshotai",
 "alibabacloud",

 "xiaomi",
 "x",
 "venice",
]);

interface ModelLogoProps {
 /** Model ID or provider name — used to resolve the brand icon. */
 modelId: string;
 /** Display size in px (default 20). */
 size?: number;
 /** Optional CSS class. */
 className?: string;
}

// SimpleIcons slug map — model/provider → SimpleIcons brand slug.
// See https://simpleicons.org for the full list.
const LOGO_MAP: Record<string, string> = {
 // OpenAI / GPT
 "openai": "openai",
 "openai-gpt-54": "openai",
 "openai-gpt-52": "openai",
 "openai-gpt-56-sol": "openai",
 "gpt-5.4": "openai",
 "gpt-5.2": "openai",
 "gpt-5.6": "openai",

 // Anthropic / Claude
 "anthropic": "anthropic",
 "claude": "anthropic",
 "claude-opus-5": "anthropic",
 "claude-sonnet-5": "anthropic",
 "claude-fable-5": "anthropic",

 // Google Gemini
 "google": "google",
 "gemini": "google",
 "gemini-3-5-flash": "google",
 "gemini-3-flash-preview": "google",

 // Meta / Llama
 "meta": "meta",
 "llama": "meta",
 "llama-3.3-70b": "meta",

 // DeepSeek
 "deepseek": "deepseek",
 "deepseek-v4-pro": "deepseek",
 "deepseek-v4-flash": "deepseek",

 // Mistral
 "mistral": "mistral",
 "mistral-small-2603": "mistral",
 "mistral-small-3-2-24b-instruct": "mistral",

 // xAI / Grok
 "xai": "x",
 "grok": "x",
 "grok-4-5": "x",
 "grok-4-20": "x",

 // Moonshot / Kimi
 "moonshot": "moonshotai",
 "kimi": "moonshotai",
 "kimi-k3": "moonshotai",
 "kimi-k2.6": "moonshotai",
 "kimi-k2-5": "moonshotai",
 "kimi-k2-7-code": "moonshotai",

 // Alibaba / Qwen
 "alibaba": "alibabacloud",
 "qwen": "alibabacloud",
 "qwen3-235b": "alibabacloud",
 "qwen3-coder-480b-a35b-instruct-turbo": "alibabacloud",
 "qwen-3-7-plus": "alibabacloud",
 "qwen-3-6-plus": "alibabacloud",

 // We do not have minimax logos anymore, using default for unknown

 // Xiaomi MiMo
 "xiaomi": "xiaomi",
 "xiaomi-mimo-v2-5": "xiaomi",

 // GLM / Zhipu — Z.ai rebrand. SimpleIcons doesn't ship a `zhipuai`
 // or `zai` slug, so we render the styled initials fallback for
 // these providers.
 "zhipu": "zhipuai",
 "glm": "zhipuai",
 "zai-org-glm-5-2": "zhipuai",
 "zai-org-glm-5-1": "zhipuai",
 "z-ai": "zhipuai",

 // Mercury / Inception
 "mercury": "inception",
 "mercury-2": "inceptionai",

 // Crypto / payment
 "usdc": "usdcoin",
 "ethereum": "ethereum",
 "base": "coinbase",
};

/** Local tiles — preferred over CDN for reliability and no CORS/CDN flakiness. */
const LOCAL_PROVIDER_ICONS: Record<string, string> = {
 openai: "/logos/providers/openai.svg",
 anthropic: "/logos/providers/anthropic.svg",
 google: "/logos/providers/google.svg",
 meta: "/logos/providers/meta.svg",
 deepseek: "/logos/providers/deepseek.svg",
 mistral: "/logos/providers/mistral.svg",
 x: "/logos/providers/xai.svg",
 xai: "/logos/providers/xai.svg",
 moonshotai: "/logos/providers/moonshot.svg",
 alibabacloud: "/logos/providers/alibaba.svg",

 xiaomi: "/logos/providers/xiaomi.svg",
 zhipuai: "/logos/providers/zai.svg",
 zai: "/logos/providers/zai.svg",
 inception: "/logos/providers/mercury.svg",
 inceptionai: "/logos/providers/mercury.svg",
 mercury: "/logos/providers/mercury.svg",
 venice: "/logos/providers/venice.svg",
};
// Fallback colors for known providers (used by SimpleIcons CDN tinting)
const PROVIDER_COLORS: Record<string, string> = {
 openai: "10a37f",
 anthropic: "d4a574",
 google: "4285f4",
 meta: "0668e1",
 deepseek: "4d6bfe",
 mistral: "ff7000",
 xai: "1d9bf0",
 moonshotai: "6366f1",
 alibabacloud: "ff6a00",

 xiaomi: "ff6900",
 zhipuai: "818cf8",
 zai: "818cf8",
 inception: "3b82f6",
 inceptionai: "3b82f6",
 coinbase: "0052ff",
};

function getProviderFromModelId(modelId: string): string {
 const lower = modelId.toLowerCase();
 if (lower.includes("openai") || lower.includes("gpt")) return "openai";
 if (lower.includes("claude") || lower.includes("anthropic")) return "anthropic";
 if (lower.includes("gemini")) return "google";
 if (lower.includes("llama") || lower.includes("meta")) return "meta";
 if (lower.includes("deepseek")) return "deepseek";
 if (lower.includes("mistral")) return "mistral";
 if (lower.includes("grok") || lower.includes("xai")) return "xai";
 if (lower.includes("kimi") || lower.includes("moonshot")) return "moonshotai";
 if (lower.includes("qwen")) return "alibabacloud";

 if (lower.includes("xiaomi") || lower.includes("mimo")) return "xiaomi";
 if (lower.includes("glm") || lower.includes("zhipu")) return "zhipuai";
 if (lower.includes("mercury")) return "inception";
 if (lower.includes("venice")) return "venice";
 return "";
}

function getInitials(modelId: string): string {
 const parts = modelId.replace(/^(openai-|claude-|zai-org-|google-)/, "").split(/[-_]/);
 if (parts.length >= 2) {
 return (parts[0][0] + parts[1][0]).toUpperCase();
 }
 return modelId.slice(0, 2).toUpperCase();
}

function getProviderColor(slug: string): string {
 return PROVIDER_COLORS[slug] ?? "6366f1";
}

export function ModelLogo({
 modelId,
 size = 20,
 className = "",
}: ModelLogoProps) {
 const [hasError, setHasError] = useState(false);

 // Resolve the SimpleIcons slug
 const directSlug = LOGO_MAP[modelId.toLowerCase()];
 const providerSlug = directSlug ?? getProviderFromModelId(modelId);
 const slug = directSlug ?? providerSlug;
 const color = getProviderColor(slug || "6366f1");

 const localSrc = slug ? LOCAL_PROVIDER_ICONS[slug] : undefined;
 if (localSrc && !hasError) {
 return (
 // eslint-disable-next-line @next/next/no-img-element -- local static SVG
 <img
 src={localSrc}
 alt=""
 width={size}
 height={size}
 className={`model-logo-svg inline-block shrink-0 rounded-[var(--radius-sm)] ${className}`}
 style={{ "--ml-size": `${size}px` } as CSSProperties}
 onError={() => setHasError(true)}
 loading="lazy"
 decoding="async"
 />
 );
 }

 // Try CDN logo first; skip slugs that 404 on SimpleIcons.
 if (slug && !hasError && !KNOWN_MISSING_SLUGS.has(slug)) {
 const url = `https://cdn.simpleicons.org/${slug}/${color}`;
 return (
 // eslint-disable-next-line @next/next/no-img-element -- remote icon CDN; next/image would need allowlist
 <img
 src={url}
 alt=""
 width={size}
 height={size}
 className={`model-logo-svg shrink-0 ${className}`}
 style={{ "--ml-size": `${size}px` } as CSSProperties}
 onError={() => setHasError(true)}
 loading="lazy"
 />
 );
 }

 // Fallback: styled initials badge
 const initials = getInitials(modelId);
 const bgColor = color ? `#${color}20` : "var(--color-accent-dim)";
 const textColor = color ? `#${color}` : "var(--color-accent)";

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
