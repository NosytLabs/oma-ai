"use client";

import { Check, Copy } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { MODEL_COUNT, MODELS, type Model } from "@/lib/models-data";
import { SyntaxHighlighter } from "../_components/SyntaxHighlighter";

export { MODEL_COUNT, MODELS };
export type { Model };

/* ==================== TYPES ==================== */

export type Tab = { label: string; lang: string; code: string };

export type PlanLimits = {
	name: string;
	rpm: number;
	tpm: number;
	concurrent: number;
	color: string;
	badge: string;
};

export type ModelPricing = {
	id: string;
	name: string;
	input: number;
	output: number;
	ctx: string;
};

export type EndpointInfo = {
	method: "GET" | "POST";
	path: string;
	title: string;
	desc: string;
	auth: string;
	body?: Record<string, string>;
	params?: { name: string; type: string; desc: string }[];
	response: string;
};

export type ErrorInfo = {
	code: number;
	type: string;
	desc: string;
};

/* ==================== DATA ==================== */

export const PLAN_LIMITS: PlanLimits[] = [
	{
		name: "Free",
		rpm: 60,
		tpm: 60000,
		concurrent: 5,
		color: "text-text-secondary",
		badge: "bg-surface text-text-secondary",
	},
	{
		name: "Starter",
		rpm: 120,
		tpm: 120000,
		concurrent: 10,
		color: "text-accent",
		badge: "bg-accent/20 text-accent",
	},
	{
		name: "Pro",
		rpm: 300,
		tpm: 300000,
		concurrent: 25,
		color: "text-tertiary",
		badge: "bg-tertiary/20 text-tertiary",
	},
	{
		name: "Business",
		rpm: 1000,
		tpm: 1000000,
		concurrent: 100,
		color: "text-warning",
		badge: "bg-warning/20 text-warning",
	},
];

export const MODEL_PRICING_ROWS: ModelPricing[] = MODELS.map((m) => ({
	id: m.id,
	name: m.name,
	input: m.inputPricePer1M,
	output: m.outputPricePer1M,
	ctx: m.contextLength,
}));

export const ENDPOINTS: EndpointInfo[] = [
	{
		method: "POST",
		path: "/v1/chat/completions",
		title: "Chat Completions",
		desc: "OpenAI-compatible multi-turn chat. The endpoint you will hit 95% of the time. Supports SSE streaming.",
		auth: "Bearer token (API key) or PAYMENT-SIGNATURE (x402)",
		body: {
			model:
				'string (required). Any model id from /v1/models, e.g. "llama-3.2-3b"',
			messages:
				"array of { role, content }. role is system, user, assistant, or tool",
			temperature: "number 0 to 2 (optional, default from upstream)",
			max_tokens: "integer. Cap on completion length",
			stream: "boolean. Server-Sent Events when true (text/event-stream)",
			tools: "array of tool definitions (optional)",
			response_format: 'object (optional), e.g. { type: "json_object" }',
		},
		response: `{
  "id": "chatcmpl-9f3k2a",
  "object": "chat.completion",
  "created": 1717194000,
  "model": "llama-3.2-3b",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "Hello. How can I help today?" },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 18, "completion_tokens": 12, "total_tokens": 30 }
}`,
	},
	{
		method: "POST",
		path: "/v1/completions",
		title: "Completions (Legacy)",
		desc: "Deprecated prompt-based completion endpoint. Use Chat Completions for new projects.",
		auth: "Bearer token (API key) or PAYMENT-SIGNATURE (x402)",
		body: {
			model: "string (required). Model id from /v1/models",
			prompt: "string (required). String only, arrays are rejected",
			max_tokens: "integer (optional)",
			temperature: "number 0 to 2 (optional)",
			top_p: "number 0 to 1 (optional)",
			n: "integer 1 to 10 (optional)",
			stop: "string | string[] (optional)",
			stream: "boolean (optional). SSE when true",
			presence_penalty: "number -2 to 2 (optional)",
			frequency_penalty: "number -2 to 2 (optional)",
		},
		response: `{
  "id": "cmpl-abc123",
  "object": "text_completion",
  "created": 1717194000,
  "model": "llama-3.2-3b",
  "choices": [{
    "text": " in a land far, far away...",
    "index": 0,
    "finish_reason": "length",
    "logprobs": null
  }],
  "usage": { "prompt_tokens": 5, "completion_tokens": 10, "total_tokens": 15 }
}`,
	},
	{
		method: "GET",
		path: "/v1/models",
		title: "List Models",
		desc: "Returns every model currently routable: text, image, video. No auth required. Cached for 1h.",
		auth: "None",
		response: `{
  "object": "list",
  "data": [
    {
      "id": "llama-3.2-3b",
      "object": "model",
      "created": 1717194000,
      "owned_by": "oma",
      "permission": [],
      "root": "llama-3.2-3b",
      "parent": null,
      "pricing": { "prompt": "0.00000006", "completion": "0.00000012" },
      "category": "chat",
      "context_length": 8192
    },
    {
      "id": "venice-flux-schnell",
      "object": "model",
      "created": 1717194000,
      "owned_by": "oma",
      "pricing": { "prompt": "0.00001000" },
      "category": "image"
    }
  ]
}`,
	},
	{
		method: "GET",
		path: "/v1/models/:model",
		title: "Get Model",
		desc: "Returns pricing, capabilities, and provider metadata for a single model. No auth required.",
		auth: "None",
		response: `{
  "id": "claude-sonnet-4",
  "object": "model",
  "created": 1717194000,
  "owned_by": "oma",
  "permission": [],
  "root": "claude-sonnet-4",
  "parent": null,
  "pricing": { "prompt": "0.00000300", "completion": "0.00001500" },
  "category": "chat",
  "context_length": 200000,
  "supports_streaming": true,
  "provider": "venice"
}`,
	},
	{
		method: "POST",
		path: "/v1/embeddings",
		title: "Embeddings",
		desc: "Vector embeddings via Venice. Use for semantic search, RAG, clustering.",
		auth: "Bearer token (API key) or PAYMENT-SIGNATURE (x402)",
		body: {
			model:
				'string (required), e.g. "text-embedding-3-small" or any Venice embedding model',
			input: "string | string[] (required), max 50,000 chars per input",
		},
		response: `{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.0023, -0.0091, 0.0027, 0.0114, -0.0042]
    }
  ],
  "model": "text-embedding-3-small",
  "usage": { "prompt_tokens": 10, "total_tokens": 10 }
}`,
	},
	{
		method: "POST",
		path: "/v1/images/generations",
		title: "Image Generation",
		desc: "Text-to-image via Venice FLUX models. Pricing is per-image.",
		auth: "Bearer token (API key) or PAYMENT-SIGNATURE (x402)",
		body: {
			model: 'string (required), e.g. "venice-flux-schnell"',
			prompt: "string (required), max 4000 chars",
			n: "integer 1 to 10 (optional, default 1)",
			size: 'string (optional), e.g. "1024x1024"',
		},
		response: `{
  "created": 1717194000,
  "data": [
    {
      "url": "https://files.oma-ai.com/img_4f3k2a.png",
      "revised_prompt": "A cat wearing a small felt hat, soft window light, 35mm"
    }
  ]
}`,
	},
	{
		method: "POST",
		path: "/v1/audio/speech",
		title: "Audio Speech (TTS)",
		desc: "Text-to-speech. Returns raw audio bytes (audio/mpeg by default).",
		auth: "Bearer token (API key) or PAYMENT-SIGNATURE (x402)",
		body: {
			model: 'string (required), e.g. "tts-1"',
			input: "string (required), max 10,000 chars",
			voice: "string (optional). Voice id",
			response_format: "string (optional): mp3 | opus | aac | flac | wav | pcm",
			speed: "number 0.25 to 4.0 (optional, default 1.0)",
		},
		response: `// 200 OK
// Content-Type: audio/mpeg
// (binary audio data)`,
	},
	{
		method: "POST",
		path: "/v1/audio/transcriptions",
		title: "Audio Transcriptions",
		desc: "Speech-to-text via Whisper. Multipart form upload.",
		auth: "Bearer token (API key) or PAYMENT-SIGNATURE (x402)",
		body: {
			file: "binary (required). Audio file to transcribe",
			model: 'string (required), e.g. "whisper-1"',
			language: 'string (optional). ISO-639-1 code, e.g. "en"',
			prompt: "string (optional). Context hint to guide the model",
			response_format:
				"string (optional): json | text | srt | verbose_json | vtt",
			temperature: "number (optional)",
		},
		response: `{
  "text": "Hello, how can I help you today?"
}`,
	},
	{
		method: "POST",
		path: "/v1/videos/generations",
		title: "Video Generation",
		desc: "Text-to-video via Venice video models. Returns a queue id. Poll /v1/videos/retrieve.",
		auth: "Bearer token (API key) or PAYMENT-SIGNATURE (x402)",
		body: {
			model: 'string (required), e.g. "venice-video-1"',
			prompt: "string (required), max 4000 chars",
			duration: 'string (optional), e.g. "5s", "10s"',
			aspect_ratio: 'string (optional), e.g. "16:9", "9:16"',
			resolution: 'string (optional), e.g. "720p", "1080p"',
			image_url: "string URL (optional). Source image for image-to-video",
		},
		response: `{
  "id": "vid_abc123",
  "object": "video",
  "status": "processing",
  "queue_id": "abc123"
}`,
	},
	{
		method: "GET",
		path: "/v1/videos/retrieve",
		title: "Video Retrieve",
		desc: "Polls the status of a video generation job by queue_id.",
		auth: "Bearer token (API key)",
		body: undefined,
		response: `// 200 OK
// {
//   "id": "vid_abc123",
//   "object": "video",
//   "status": "completed",     // "processing" | "completed"
//   "video_url": "https://files.oma-ai.com/vid_abc123.mp4"
// }`,
	},
];

export const ERROR_CODES: ErrorInfo[] = [
	{
		code: 400,
		type: "bad_request",
		desc: "Malformed request body or invalid parameters.",
	},
	{ code: 401, type: "unauthorized", desc: "Missing or invalid API key." },
	{
		code: 402,
		type: "payment_required",
		desc: "Insufficient credits. Deposit more or use x402 pay-per-request.",
	},
	{
		code: 429,
		type: "rate_limited",
		desc: "Rate limit exceeded. Retry after X-RateLimit-Reset seconds.",
	},
	{
		code: 500,
		type: "internal_error",
		desc: "Unexpected server error. Contact support if persistent.",
	},
	{
		code: 503,
		type: "service_unavailable",
		desc: "All upstream providers down. Try again shortly.",
	},
];

export const QUICK_START_STEPS = [
	{
		n: "1",
		title: "Get API Key",
		desc: "Create an account and generate your API key from the dashboard.",
	},
	{
		n: "2",
		title: "Add to Headers",
		desc: "Include your key in the Authorization header: Bearer oma_sk_...",
	},
	{
		n: "3",
		title: "Start Building",
		desc: "Use the OpenAI SDK with base_url=https://api.oma-ai.com/v1",
	},
];

/* ==================== HELPERS ==================== */

export function fmt(n: number): string {
	if (n === 0) return "$0.00";
	if (n < 0.01) return "$0.01";
	return `$${n.toFixed(2)}`;
}

function CopyButton({ text, id }: { text: string; id: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<button
			type="button"
			onClick={() => {
				navigator.clipboard.writeText(text);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			}}
			className="absolute right-3 top-3 rounded-lg border border-border/50 bg-surface/80 p-1.5 text-text-muted backdrop-blur-sm transition-all hover:border-accent/50 hover:text-accent active:scale-95"
			aria-label={copied ? "Copied" : "Copy code"}
			aria-controls={id}
		>
			{copied ? (
				<Check className="h-4 w-4 text-success" />
			) : (
				<Copy className="h-4 w-4" />
			)}
		</button>
	);
}

export function CodeBlock({
	code,
	title,
	lang,
}: {
	code: string;
	title?: string;
	lang?: string;
}) {
	const id = useId();
	return (
		<div className="group relative max-w-full min-w-0 overflow-hidden rounded-xl border border-border bg-panel">
			{title && (
				<div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
					<span className="text-xs font-medium text-text-muted font-mono">
						{title}
					</span>
				</div>
			)}
			<CopyButton text={code} id={id} />
			<section
				aria-label={title ?? "Code example"}
				tabIndex={0}
				className="max-w-full min-w-0 overflow-x-auto p-4 text-sm leading-relaxed"
			>
				<pre id={id} className="m-0 max-w-full overflow-x-auto leading-relaxed">
					<SyntaxHighlighter code={code} lang={lang ?? "text"} />
				</pre>
			</section>
		</div>
	);
}

export function TabbedCode({ tabs }: { tabs: Tab[] }) {
	const [active, setActive] = useState(0);
	const id = useId();
	return (
		<div className="max-w-full min-w-0 overflow-hidden rounded-xl border border-border bg-panel">
			<div className="flex max-w-full overflow-x-auto border-b border-border/50 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				{tabs.map((t, i) => (
					<button
						type="button"
						key={t.label}
						onClick={() => setActive(i)}
						className={`shrink-0 px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
							i === active
								? "text-accent border-accent"
								: "text-text-muted border-transparent hover:text-text-secondary"
						}`}
					>
						{t.label}
					</button>
				))}
			</div>
			<div className="relative min-w-0 max-w-full">
				<CopyButton text={tabs[active].code} id={id} />
				<section
					aria-label={tabs[active].label}
					tabIndex={0}
					className="max-w-full min-w-0 overflow-x-auto p-4 text-sm leading-relaxed"
				>
					<pre id={id} className="m-0 max-w-full overflow-x-auto leading-relaxed">
						<SyntaxHighlighter
							code={tabs[active].code}
							lang={tabs[active].lang}
						/>
					</pre>
				</section>
			</div>
		</div>
	);
}

export function SectionHeading({
	id,
	icon,
	title,
	subtitle,
}: {
	id: string;
	icon: ReactNode;
	title: string;
	subtitle: string;
}) {
	return (
		<div id={id} className="mb-6 flex items-start gap-4 scroll-mt-24">
			<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20">
				{icon}
			</div>
			<div>
				<h2 className="text-xl font-bold text-text font-display">{title}</h2>
				<p className="mt-1 text-sm text-text-muted">{subtitle}</p>
			</div>
		</div>
	);
}

export function AnimatedSection({
	children,
	delay = 0,
}: {
	children: ReactNode;
	delay?: number;
}) {
	const [visible, setVisible] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const obs = new IntersectionObserver(
			([e]) => {
				if (e.isIntersecting) {
					setVisible(true);
					obs.unobserve(el);
				}
			},
			{ threshold: 0.1 },
		);
		obs.observe(el);
		return () => obs.disconnect();
	}, []);

	return (
		<div
			ref={ref}
			className={`transition-all duration-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
			style={{ transitionDelay: `${delay}ms` }}
		>
			{children}
		</div>
	);
}
