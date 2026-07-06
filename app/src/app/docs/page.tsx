// ponytail: production URL (https://api.oma-ai.com/v1) — references resolve once the gateway is deployed (audit C-1).
"use client";

import {
	AlertCircle,
	BookOpen,
	Check,
	CheckCircle2,
	ChevronRight,
	Copy,
	DollarSign,
	Gauge,
	Key,
	Lock,
	Menu,
	Package,
	Play,
	Shield,
	Sparkles,
	Terminal,
	X,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { MODEL_COUNT, MODELS } from "@/lib/models-data";
import { DocsSearch } from "./_components/DocsSearch";
import { SyntaxHighlighter } from "./_components/SyntaxHighlighter";
import { NAV_ITEMS } from "./_lib/nav-data";

/* ==================== TYPES ==================== */

type Tab = { label: string; lang: string; code: string };

type PlanLimits = {
	name: string;
	rpm: number;
	tpm: number;
	concurrent: number;
	color: string;
	badge: string;
};

type ModelPricing = {
	id: string;
	name: string;
	input: number;
	output: number;
	ctx: string;
};

type EndpointInfo = {
	method: "GET" | "POST";
	path: string;
	title: string;
	desc: string;
	auth: string;
	body?: Record<string, string>;
	params?: { name: string; type: string; desc: string }[];
	response: string;
};

type ErrorInfo = {
	code: number;
	type: string;
	desc: string;
};

/* ==================== DATA ==================== */

const PLAN_LIMITS: PlanLimits[] = [
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

const MODEL_PRICING_ROWS: ModelPricing[] = MODELS.map((m) => ({
	id: m.id,
	name: m.name,
	input: m.inputPricePer1M,
	output: m.outputPricePer1M,
	ctx: m.contextLength,
}));

const ENDPOINTS: EndpointInfo[] = [
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
  "provider": "anthropic"
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

const ERROR_CODES: ErrorInfo[] = [
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

const QUICK_START_STEPS = [
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

function fmt(n: number): string {
	if (n === 0) return "$0.00";
	if (n < 0.01) return "$0.01";
	return `$${n.toFixed(2)}`;
}

/* ==================== COMPONENTS ==================== */

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
				<Check className="h-4 w-4 text-orange" />
			) : (
				<Copy className="h-4 w-4" />
			)}
		</button>
	);
}

function CodeBlock({
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
		<div className="group relative overflow-hidden rounded-xl border border-border bg-panel">
			{title && (
				<div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
					<span className="text-xs font-medium text-text-muted font-mono">
						{title}
					</span>
				</div>
			)}
			<CopyButton text={code} id={id} />
			<pre id={id} className="overflow-x-auto p-4 text-sm leading-relaxed">
				<SyntaxHighlighter code={code} lang={lang ?? "text"} />
			</pre>
		</div>
	);
}

function TabbedCode({ tabs }: { tabs: Tab[] }) {
	const [active, setActive] = useState(0);
	const id = useId();
	return (
		<div className="overflow-hidden rounded-xl border border-border bg-panel">
			<div className="flex border-b border-border/50">
				{tabs.map((t, i) => (
					<button
						type="button"
						key={t.label}
						onClick={() => setActive(i)}
						className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
							i === active
								? "text-accent border-accent"
								: "text-text-muted border-transparent hover:text-text-secondary"
						}`}
					>
						{t.label}
					</button>
				))}
			</div>
			<div className="relative">
				<CopyButton text={tabs[active].code} id={id} />
				<pre id={id} className="overflow-x-auto p-4 text-sm leading-relaxed">
					<SyntaxHighlighter
						code={tabs[active].code}
						lang={tabs[active].lang}
					/>
				</pre>
			</div>
		</div>
	);
}

function SectionHeading({
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

function AnimatedSection({
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
			className={`transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
			style={{ transitionDelay: `${delay}ms` }}
		>
			{children}
		</div>
	);
}

/* ==================== SECTIONS ==================== */

function QuickStartSection() {
	const curlCode = `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.2-3b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;

	return (
		<AnimatedSection>
			<SectionHeading
				id="quickstart"
				icon={<Play className="h-5 w-5" />}
				title="Quick Start"
				subtitle="Get up and running with the OMA API in under a minute."
			/>

			<div className="mb-8 grid gap-4 sm:grid-cols-3">
				{QUICK_START_STEPS.map((step) => (
					<div
						key={step.n}
						className="rounded-xl border border-border bg-surface/50 p-5"
					>
						<div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent text-sm font-bold font-mono">
							{step.n}
						</div>
						<h3 className="mb-1 font-semibold text-text">{step.title}</h3>
						<p className="text-sm text-text-muted">{step.desc}</p>
					</div>
				))}
			</div>

			<div className="relative rounded-xl border border-border bg-panel p-6">
				<div className="mb-4 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Terminal className="h-4 w-4 text-accent" />
						<span className="text-sm font-medium text-text">
							Your First Request
						</span>
					</div>
					<span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-mono text-accent border border-accent/20">
						cURL
					</span>
				</div>
				<CodeBlock code={curlCode} lang="bash" />
			</div>

			<div className="mt-4 grid gap-3 sm:grid-cols-2">
				<div className="rounded-lg border border-border bg-surface/50 p-3">
					<div className="text-xs text-text-muted mb-1">Base URL</div>
					<code className="text-sm text-accent">https://api.oma-ai.com/v1</code>
				</div>
				<div className="rounded-lg border border-border bg-surface/50 p-3">
					<div className="text-xs text-text-muted mb-1">SDK Install</div>
					<code className="text-sm text-accent">npm install openai</code>
				</div>
			</div>
		</AnimatedSection>
	);
}

function AuthenticationSection() {
	const pythonCode = `from openai import OpenAI
client = OpenAI(
    api_key="oma_sk_your_key_here",
    base_url="https://api.oma-ai.com/v1"
)
response = client.chat.completions.create(
    model="llama-3.2-3b",
    messages=[{"role": "user", "content": "Hello!"}]
)`;

	const jsCode = `import OpenAI from "openai";
const client = new OpenAI({
  apiKey: "oma_sk_your_key_here",
  baseURL: "https://api.oma-ai.com/v1"
});
const response = await client.chat.completions.create({
  model: "llama-3.2-3b",
  messages: [{ role: "user", content: "Hello!" }]
});`;

	const goCode = `package main
import (
    openai "github.com/sashabaranov/go-openai"
)
func main() {
    client := openai.New("oma_sk_your_key_here")
    client.BaseURL = "https://api.oma-ai.com/v1"
}`;

	return (
		<AnimatedSection delay={100}>
			<SectionHeading
				id="authentication"
				icon={<Key className="h-5 w-5" />}
				title="Authentication"
				subtitle="All inference endpoints require a Bearer token API key in the Authorization header."
			/>

			<div className="rounded-xl border border-border bg-panel p-5 mb-6">
				<div className="mb-3 text-sm text-text-muted">Authorization Header</div>
				<div className="rounded-lg bg-surface/80 border border-border/50 p-3 font-mono text-sm">
					<span className="text-warning">Authorization:</span>{" "}
					<span className="text-accent">Bearer oma_sk_...</span>
				</div>
			</div>

			<TabbedCode
				tabs={[
					{
						label: "cURL",
						lang: "bash",
						code: `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"llama-3.2-3b","messages":[{"role":"user","content":"Hello"}]}'`,
					},
					{ label: "Python", lang: "python", code: pythonCode },
					{ label: "JavaScript", lang: "javascript", code: jsCode },
					{ label: "Go", lang: "go", code: goCode },
				]}
			/>

			<div className="mt-6 rounded-xl border border-warning/20 bg-warning/5 p-4">
				<div className="flex items-start gap-3">
					<Shield className="h-5 w-5 text-warning mt-0.5" />
					<div>
						<h4 className="font-semibold text-warning">API Key Security</h4>
						<p className="mt-1 text-sm text-text-muted">
							Keys use the{" "}
							<code className="text-warning font-mono">oma_sk_</code> prefix.
							Only the SHA-256 hash is stored. Keep your key secret and never
							commit it to version control.
						</p>
					</div>
				</div>
			</div>
		</AnimatedSection>
	);
}

function EndpointsSection() {
	const [expanded, setExpanded] = useState<string | null>(
		"/v1/chat/completions",
	);

	return (
		<AnimatedSection delay={200}>
			<SectionHeading
				id="endpoints"
				icon={<Terminal className="h-5 w-5" />}
				title="Endpoints Reference"
				subtitle="OpenAI-compatible REST API endpoints."
			/>

			<div className="space-y-4">
				{ENDPOINTS.map((ep) => (
					<div
						key={ep.path}
						className="rounded-xl border border-border bg-surface/50 overflow-hidden"
					>
						<button
							type="button"
							onClick={() => setExpanded(expanded === ep.path ? null : ep.path)}
							className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-surface/80"
						>
							<div className="flex items-center gap-3">
								<span
									className={`rounded-md px-2.5 py-1 font-mono text-xs font-bold uppercase ${
										ep.method === "GET"
											? "bg-orange/10 text-orange"
											: "bg-accent/10 text-accent"
									}`}
								>
									{ep.method}
								</span>
								<code className="font-mono text-sm text-text">{ep.path}</code>
							</div>
							<div className="flex items-center gap-2">
								{ep.method === "POST" && (
									<span className="flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-0.5 text-xs text-text-muted border border-border">
										<Lock className="h-3 w-3" /> Auth
									</span>
								)}
								<ChevronRight
									className={`h-4 w-4 text-text-muted transition-transform ${expanded === ep.path ? "rotate-90" : ""}`}
								/>
							</div>
						</button>

						{expanded === ep.path && (
							<div className="border-t border-border p-4 space-y-4">
								<p className="text-sm text-text-muted">{ep.desc}</p>

								{ep.body && (
									<div>
										<h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
											Request Body
										</h4>
										<div className="rounded-lg border border-border/50 bg-panel p-4 space-y-2">
											{Object.entries(ep.body).map(([key, val]) => (
												<div key={key} className="flex gap-3 font-mono text-sm">
													<span className="text-accent shrink-0">{key}</span>
													<span className="text-text-muted">{val}</span>
												</div>
											))}
										</div>
									</div>
								)}

								<div>
									<h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
										Response
									</h4>
									<CodeBlock code={ep.response} lang="json" />
								</div>
							</div>
						)}
					</div>
				))}
			</div>
		</AnimatedSection>
	);
}

function AvailableModelsSection() {
	const tiers = [
		{
			id: "budget",
			name: "Budget",
			color: "text-warning",
			badge: "bg-warning/20 text-warning",
			desc: "Fast, cost-effective models for simple tasks and prototyping.",
			models: MODELS.filter((m) => m.tier === "budget"),
		},
		{
			id: "mid",
			name: "Mid-Tier",
			color: "text-accent",
			badge: "bg-accent/20 text-accent",
			desc: "Balanced performance and cost for everyday workloads.",
			models: MODELS.filter((m) => m.tier === "mid"),
		},
		{
			id: "premium",
			name: "Premium",
			color: "text-violet",
			badge: "bg-violet/20 text-violet",
			desc: "High-performance models for demanding tasks.",
			models: MODELS.filter((m) => m.tier === "premium"),
		},
		{
			id: "frontier",
			name: "Frontier",
			color: "text-violet",
			badge: "bg-violet/20 text-violet",
			desc: "State-of-the-art models with maximum capability.",
			models: MODELS.filter((m) => m.tier === "frontier"),
		},
	];

	return (
		<AnimatedSection delay={250}>
			<SectionHeading
				id="models"
				icon={<BookOpen className="h-5 w-5" />}
				title="Available Models"
				subtitle={`${MODEL_COUNT} models across text, image, video, and audio categories.`}
			/>

			<div className="mb-6 grid gap-4 sm:grid-cols-2">
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<div className="mb-2 flex items-center gap-2">
						<Terminal className="h-4 w-4 text-accent" />
						<span className="font-semibold text-text">Text Models</span>
					</div>
					<p className="text-sm text-text-muted">
						Chat, reasoning, coding, and instruction-following models from
						multiple providers.
					</p>
				</div>
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<div className="mb-2 flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-orange" />
						<span className="font-semibold text-text">Multimodal</span>
					</div>
					<p className="text-sm text-text-muted">
						Image generation, video generation, audio transcription, and text-to-speech
						models.
					</p>
				</div>
			</div>

			<div className="space-y-6">
				{tiers.map((tier) => (
					<div key={tier.id} className="rounded-xl border border-border bg-surface/50 overflow-hidden">
						<div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
							<div className="flex items-center gap-3">
								<span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tier.badge}`}>
									{tier.name}
								</span>
								<span className="text-sm text-text-muted">{tier.models.length} models</span>
							</div>
						</div>
						<div className="p-4">
							<p className="mb-4 text-sm text-text-muted">{tier.desc}</p>
							<div className="overflow-x-auto">
								<table className="w-full text-left text-sm">
									<thead>
										<tr className="border-b border-border/50">
											<th className="pb-2 font-medium text-text-muted">Model</th>
											<th className="pb-2 font-medium text-text-muted text-right">Input / 1M</th>
											<th className="pb-2 font-medium text-text-muted text-right">Output / 1M</th>
											<th className="pb-2 font-medium text-text-muted text-right">Context</th>
											<th className="pb-2 font-medium text-text-muted">Capabilities</th>
										</tr>
									</thead>
									<tbody>
										{tier.models.map((m) => (
											<tr key={m.id} className="border-b border-border/30 last:border-0">
												<td className="py-2">
													<code className="font-mono text-xs text-accent">{m.id}</code>
													<div className="text-xs text-text-muted">{m.name}</div>
												</td>
												<td className="py-2 text-right font-mono text-xs text-text-secondary">
													{fmt(m.inputPricePer1M)}
												</td>
												<td className="py-2 text-right font-mono text-xs text-text-secondary">
													{fmt(m.outputPricePer1M)}
												</td>
												<td className="py-2 text-right text-xs text-text-muted">
													{m.contextLength}
												</td>
												<td className="py-2">
													<div className="flex flex-wrap gap-1">
														{m.capabilities.map((cap) => (
															<span key={cap} className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">
																{cap}
															</span>
														))}
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				))}
			</div>

			<div className="mt-6 rounded-xl border border-accent/20 bg-accent/5 p-4">
				<div className="flex items-start gap-3">
					<Terminal className="h-5 w-5 text-accent mt-0.5" />
					<div>
						<h4 className="font-semibold text-accent">List All Models</h4>
						<p className="mt-1 text-sm text-text-muted">
							Use the <code className="font-mono">GET /v1/models</code> endpoint to fetch the
							current model catalog with pricing and capabilities.
						</p>
						<CodeBlock
							code={`curl https://api.oma-ai.com/v1/models | jq '.data | length'`}
							lang="bash"
						/>
					</div>
				</div>
			</div>
		</AnimatedSection>
	);
}

function StreamingSection() {
	const streamCode = `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.3-70b",
    "messages": [{"role": "user", "content": "Write a haiku about coding"}],
    "stream": true
  }'`;

	const streamResponse = `data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1717194000,"model":"llama-3.3-70b","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1717194000,"model":"llama-3.3-70b","choices":[{"index":0,"delta":{"content":"Code"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1717194000,"model":"llama-3.3-70b","choices":[{"index":0,"delta":{"content":" flows"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1717194000,"model":"llama-3.3-70b","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]`;

	const pythonStreamCode = `from openai import OpenAI
client = OpenAI(
    api_key="oma_sk_your_key_here",
    base_url="https://api.oma-ai.com/v1"
)

stream = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Write a haiku about coding"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")`;

	const jsStreamCode = `import OpenAI from "openai";
const client = new OpenAI({
  apiKey: "oma_sk_your_key_here",
  baseURL: "https://api.oma-ai.com/v1"
});

const stream = await client.chat.completions.create({
  model: "llama-3.3-70b",
  messages: [{ role: "user", content: "Write a haiku about coding" }],
  stream: true
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) process.stdout.write(content);
}`;

	return (
		<AnimatedSection delay={275}>
			<SectionHeading
				id="streaming"
				icon={<Zap className="h-5 w-5" />}
				title="Streaming"
				subtitle="Real-time token-by-token responses via Server-Sent Events (SSE)."
			/>

			<div className="rounded-xl border border-accent/20 bg-accent/5 p-4 mb-6">
				<div className="flex items-start gap-3">
					<Zap className="h-5 w-5 text-accent mt-0.5" />
					<div>
						<h4 className="font-semibold text-accent">Why Stream?</h4>
						<p className="mt-1 text-sm text-text-muted">
							Streaming provides real-time output as tokens are generated, reducing
							perceived latency from seconds to milliseconds. Essential for chat
							interfaces and interactive applications.
						</p>
					</div>
				</div>
			</div>

			<div className="mb-6">
				<h4 className="mb-3 text-sm font-semibold text-text">Enable Streaming</h4>
				<p className="mb-4 text-sm text-text-muted">
					Add <code className="font-mono text-accent">&quot;stream&quot;: true</code> to your request body.
					Responses arrive as Server-Sent Events (SSE) with <code className="font-mono text-accent">Content-Type: text/event-stream</code>.
				</p>
				<CodeBlock code={streamCode} lang="bash" title="Request with stream: true" />
			</div>

			<div className="mb-6">
				<h4 className="mb-3 text-sm font-semibold text-text">Stream Response Format</h4>
				<p className="mb-4 text-sm text-text-muted">
					Each event contains a <code className="font-mono text-accent">chat.completion.chunk</code> with
					a <code className="font-mono text-accent">delta</code> field containing partial content.
					The stream ends with <code className="font-mono text-accent">data: [DONE]</code>.
				</p>
				<CodeBlock code={streamResponse} lang="text" title="SSE Response Stream" />
			</div>

			<div className="rounded-xl border border-border bg-surface/50 p-5">
				<h4 className="mb-3 font-semibold text-text">SDK Examples</h4>
				<TabbedCode
					tabs={[
						{ label: "Python", lang: "python", code: pythonStreamCode },
						{ label: "JavaScript", lang: "javascript", code: jsStreamCode },
					]}
				/>
			</div>

			<div className="mt-6 grid gap-4 sm:grid-cols-2">
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<h4 className="mb-2 font-semibold text-text">Streaming Headers</h4>
					<div className="space-y-1 font-mono text-xs text-text-muted">
						<div>
							<span className="text-accent">Content-Type</span>: text/event-stream
						</div>
						<div>
							<span className="text-accent">Cache-Control</span>: no-cache
						</div>
						<div>
							<span className="text-accent">Connection</span>: keep-alive
						</div>
						<div>
							<span className="text-accent">X-Accel-Buffering</span>: no
						</div>
					</div>
				</div>
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<h4 className="mb-2 font-semibold text-text">Response Headers</h4>
					<div className="space-y-1 font-mono text-xs text-text-muted">
						<div>
							<span className="text-accent">x-provider</span>: Provider handling the request
						</div>
						<div>
							<span className="text-accent">X-Correlation-ID</span>: Request tracking ID
						</div>
						<div>
							<span className="text-accent">X-Key-Rotation-Recommended</span>: Key age advisory
						</div>
					</div>
				</div>
			</div>
		</AnimatedSection>
	);
}

function RateLimitsSection() {
	return (
		<AnimatedSection delay={300}>
			<SectionHeading
				id="rate-limits"
				icon={<Gauge className="h-5 w-5" />}
				title="Rate Limits"
				subtitle="Per-plan request and token limits with burst handling."
			/>

			<div className="mb-6 overflow-hidden rounded-xl border border-border">
				<table className="w-full text-left text-sm">
					<thead>
						<tr className="border-b border-border bg-surface/50">
							<th className="px-4 py-3 font-medium text-text-muted">Plan</th>
							<th className="px-4 py-3 font-medium text-text-muted text-right">
								RPM
							</th>
							<th className="px-4 py-3 font-medium text-text-muted text-right">
								TPM
							</th>
							<th className="px-4 py-3 font-medium text-text-muted text-right">
								Concurrent
							</th>
						</tr>
					</thead>
					<tbody>
						{PLAN_LIMITS.map((p, i) => (
							<tr
								key={p.name}
								className={`border-b border-border/50 ${i % 2 === 1 ? "bg-surface/30" : ""}`}
							>
								<td className="px-4 py-3">
									<span
										className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${p.badge}`}
									>
										{p.name}
									</span>
								</td>
								<td className="px-4 py-3 text-right font-mono text-text-secondary">
									{p.rpm.toLocaleString()}
								</td>
								<td className="px-4 py-3 text-right font-mono text-text-secondary">
									{p.tpm.toLocaleString()}
								</td>
								<td className="px-4 py-3 text-right font-mono text-text-secondary">
									{p.concurrent}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<h4 className="mb-2 font-semibold text-text">Burst Handling</h4>
					<p className="text-sm text-text-muted">
						Token bucket algorithm allows short bursts above the sustained rate.
						Excess tokens are spilled into the next window.
					</p>
				</div>
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<h4 className="mb-2 font-semibold text-text">Rate Limit Headers</h4>
					<div className="space-y-1 font-mono text-xs text-text-muted">
						<div>
							<span className="text-accent">X-RateLimit-Limit</span> - Requests
							per minute
						</div>
						<div>
							<span className="text-accent">X-RateLimit-Remaining</span> -
							Requests left
						</div>
						<div>
							<span className="text-accent">X-RateLimit-Reset</span> - Seconds
							until reset
						</div>
					</div>
				</div>
			</div>
		</AnimatedSection>
	);
}

function PricingSection() {
	return (
		<AnimatedSection delay={400}>
			<SectionHeading
				id="pricing"
				icon={<DollarSign className="h-5 w-5" />}
				title="Pricing"
				subtitle="Per-model pricing. Input and output priced per million tokens."
			/>

			<div className="mb-6 rounded-xl border border-border overflow-hidden">
				<table className="w-full text-left text-sm">
					<thead>
						<tr className="border-b border-border bg-surface/50">
							<th className="px-4 py-3 font-medium text-text-muted">Model</th>
							<th className="px-4 py-3 text-right font-medium text-text-muted">
								Input / 1M
							</th>
							<th className="px-4 py-3 text-right font-medium text-text-muted">
								Output / 1M
							</th>
							<th className="px-4 py-3 text-right font-medium text-text-muted">
								Context
							</th>
						</tr>
					</thead>
					<tbody>
						{MODEL_PRICING_ROWS.map((m, i) => (
							<tr
								key={m.id}
								className={`border-b border-border/50 ${i % 2 === 1 ? "bg-surface/30" : ""}`}
							>
								<td className="px-4 py-3 font-medium text-text">{m.name}</td>
								<td className="px-4 py-3 text-right font-mono text-accent">
									{fmt(m.input)}
								</td>
								<td className="px-4 py-3 text-right font-mono text-text-secondary">
									{fmt(m.output)}
								</td>
								<td className="px-4 py-3 text-right text-text-muted">
									{m.ctx}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
				<h4 className="font-semibold text-accent">Credit Deduction</h4>
				<div className="mt-2 grid gap-2 sm:grid-cols-2">
					<div className="flex items-start gap-2">
						<CheckCircle2 className="h-4 w-4 text-accent mt-0.5" />
						<span className="text-sm text-text-muted">
							$1 = $1. Billed per token in real-time.
						</span>
					</div>

					<div className="flex items-start gap-2">
						<CheckCircle2 className="h-4 w-4 text-accent mt-0.5" />
						<span className="text-sm text-text-muted">
							No minimums or subscriptions
						</span>
					</div>
					<div className="flex items-start gap-2">
						<CheckCircle2 className="h-4 w-4 text-accent mt-0.5" />
						<span className="text-sm text-text-muted">
							12-month rolling expiry
						</span>
					</div>
				</div>
			</div>
		</AnimatedSection>
	);
}

function X402Section() {
	const flowCode = `# 1. Request without credits — API returns 402
curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_agent_key" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"llama-3.3-70b","messages":[{"role":"user","content":"Hello"}]}'

# Response: 402 Payment Required
# WWW-Authenticate: X-PAYMENT pay-Req: {"x402Version":"1","scheme":"evm","networkId":"base","asset":"0x8335...","amount":"0.00025","payee":"0x..."}

# 2. Pay USDC on Base (signed with your wallet), then retry with the receipt header
# Use viem, ethers, or any EIP-3009 signer to construct transferWithAuthorization

# 3. Retry with PAYMENT-SIGNATURE header — SUCCESS
curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_agent_key" \\
  -H "Content-Type: application/json" \\
  -H "PAYMENT-SIGNATURE: <base64-json-signature>" \\
  -d '{"model":"llama-3.3-70b","messages":[{"role":"user","content":"Hello"}]}'`;

	const agentCode = `import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const account = privateKeyToAccount(process.env.AGENT_KEY);
const publicClient = createPublicClient({ chain: base, transport: http() });

// 1) Call the API; if it returns 402, the WWW-Authenticate header
//    carries the payment requirements (payee, asset, amount, network).
// 2) Sign a USDC transferWithAuthorization (EIP-3009) to the payee.
// 3) Retry the original request with PAYMENT-SIGNATURE: <base64>.
//
// The OMA server verifies the signature against the on-chain USDC
// contract and settles the request when the authorization is valid.
// See the open x402 spec (https://x402.org) for the request shape.

const res = await fetch('https://api.oma-ai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama-3.3-70b',
    messages: [{ role: 'user', content: 'Write a smart contract' }],
  }),
});

if (res.status === 402) {
  const payReq = parsePayReq(res.headers.get('www-authenticate'));
  // sign + retry omitted for brevity
}

const json = await res.json();`;

	return (
		<AnimatedSection delay={450}>
			<SectionHeading
				id="x402"
				icon={<Zap className="h-5 w-5" />}
				title="x402 Payments"
				subtitle="Per-request USDC payments on Base. No account, no credit pre-funding."
			/>

			<div className="rounded-xl border border-warning/20 bg-warning/5 p-4 mb-6">
				<div className="flex items-start gap-3">
					<Zap className="h-5 w-5 text-warning mt-0.5" />
					<div>
						<h4 className="font-semibold text-warning">x402 — Per-Request Payments</h4>
						<p className="mt-1 text-sm text-text-muted">
							Agents can call any OMA endpoint without pre-funding credits.
							When the request has no usable balance, the API returns HTTP
							402 with payment requirements (payee, asset, amount, chain).
							Sign a USDC transferWithAuthorization (EIP-3009) on Base and
							retry with the receipt. The server verifies the signature and
							settles the request — no human in the loop.
						</p>
					</div>
				</div>
			</div>

			<div className="mb-6">
				<h4 className="mb-3 text-sm font-semibold text-text">
					402 Payment Flow
				</h4>
				<CodeBlock code={flowCode} lang="bash" />
			</div>

			<div className="rounded-xl border border-border bg-surface/50 p-5">
				<h4 className="mb-3 font-semibold text-text">For AI Agents</h4>
				<p className="text-sm text-text-muted mb-4">
					Use <code className="text-accent font-mono">viem</code> or{" "}
					<code className="text-accent font-mono">ethers</code> directly to
					sign USDC payment authorizations. No first-party SDK is required.
					Ideal for agents that make sporadic API calls and don&apos;t want to
					manage credit balances.
				</p>
				<CodeBlock code={agentCode} lang="javascript" />
			</div>

			<div className="mt-6 grid gap-4 sm:grid-cols-2">
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<h4 className="mb-2 font-semibold text-text">Benefits</h4>
					<ul className="space-y-1.5 text-sm text-text-muted">
						<li className="flex items-start gap-2">
							<CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />{" "}
							No credit pre-funding
						</li>
						<li className="flex items-start gap-2">
							<CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />{" "}
							Per-request billing
						</li>
						<li className="flex items-start gap-2">
							<CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />{" "}
							Standard x402 protocol
						</li>
					</ul>
				</div>
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<h4 className="mb-2 font-semibold text-text">Supported Networks</h4>
					<ul className="space-y-1.5 text-sm text-text-muted">
						<li className="flex items-start gap-2">
							<CheckCircle2 className="h-4 w-4 text-orange mt-0.5 shrink-0" />{" "}
							Base mainnet (USDC)
						</li>
						<li className="flex items-start gap-2">
							<CheckCircle2 className="h-4 w-4 text-orange mt-0.5 shrink-0" />{" "}
							Base Sepolia (USDC, dev only)
						</li>
					</ul>
				</div>
			</div>
		</AnimatedSection>
	);
}

function SDKsSection() {
	/* ── Chat Completion examples ── */
	const pythonChatCode = `from openai import OpenAI

client = OpenAI(
    api_key="oma_sk_your_key_here",
    base_url="https://api.oma-ai.com/v1"
)

response = client.chat.completions.create(
    model="deepseek-v3.2",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain quantum computing in one sentence."}
    ],
    temperature=0.7,
    max_tokens=256
)

print(response.choices[0].message.content)`;

	const tsChatCode = `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "oma_sk_your_key_here",
  baseURL: "https://api.oma-ai.com/v1",
});

const response = await client.chat.completions.create({
  model: "deepseek-v3.2",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Explain quantum computing in one sentence." },
  ],
  temperature: 0.7,
  max_tokens: 256,
});

console.log(response.choices[0].message.content);`;

	const curlChatCode = `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-v3.2",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Explain quantum computing in one sentence."}
    ],
    "temperature": 0.7,
    "max_tokens": 256
  }'`;

	const goChatCode = `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func main() {
	body, _ := json.Marshal(map[string]any{
		"model": "deepseek-v3.2",
		"messages": []map[string]string{
			{"role": "system", "content": "You are a helpful assistant."},
			{"role": "user", "content": "Explain quantum computing in one sentence."},
		},
		"temperature": 0.7,
		"max_tokens":  256,
	})

	req, _ := http.NewRequest("POST",
		"https://api.oma-ai.com/v1/chat/completions",
		bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer oma_sk_your_key_here")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	fmt.Println(string(data))
}`;

	/* ── Streaming examples ── */
	const pythonStreamCode = `from openai import OpenAI

client = OpenAI(
    api_key="oma_sk_your_key_here",
    base_url="https://api.oma-ai.com/v1"
)

stream = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Write a haiku about coding"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")`;

	const tsStreamCode = `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "oma_sk_your_key_here",
  baseURL: "https://api.oma-ai.com/v1",
});

const stream = await client.chat.completions.create({
  model: "llama-3.3-70b",
  messages: [{ role: "user", content: "Write a haiku about coding" }],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) process.stdout.write(content);
}`;

	const curlStreamCode = `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.3-70b",
    "messages": [{"role": "user", "content": "Write a haiku about coding"}],
    "stream": true
  }'`;

	const goStreamCode = `package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

func main() {
	body, _ := json.Marshal(map[string]any{
		"model": "llama-3.3-70b",
		"messages": []map[string]string{
			{"role": "user", "content": "Write a haiku about coding"},
		},
		"stream": true,
	})

	req, _ := http.NewRequest("POST",
		"https://api.oma-ai.com/v1/chat/completions",
		bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer oma_sk_your_key_here")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}
		var chunk map[string]any
		json.Unmarshal([]byte(data), &chunk)
		// Extract delta.content from chunk
		fmt.Print(data)
	}
}`;

	/* ── List Models examples ── */
	const pythonModelsCode = `from openai import OpenAI

client = OpenAI(
    api_key="oma_sk_your_key_here",
    base_url="https://api.oma-ai.com/v1"
)

models = client.models.list()
for model in models.data:
    print(f"{model.id} ({model.get('category', 'chat')})")`;

	const tsModelsCode = `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "oma_sk_your_key_here",
  baseURL: "https://api.oma-ai.com/v1",
});

const models = await client.models.list();
for (const model of models.data) {
  console.log(\`\${model.id} (\${(model as Record<string, unknown>).category ?? "chat"})\`);
}`;

	const curlModelsCode = `curl https://api.oma-ai.com/v1/models \\
  -H "Authorization: Bearer oma_sk_your_key_here" | jq '.data[].id'`;

	const goModelsCode = `package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func main() {
	req, _ := http.NewRequest("GET",
		"https://api.oma-ai.com/v1/models", nil)
	req.Header.Set("Authorization", "Bearer oma_sk_your_key_here")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	var result struct {
		Data []struct {
			ID string \`json:"id"\`
		} \`json:"data"\`
	}
	json.Unmarshal(data, &result)
	for _, m := range result.Data {
		fmt.Println(m.ID)
	}
}`;

	return (
		<AnimatedSection delay={500}>
			<SectionHeading
				id="sdks"
				icon={<Package className="h-5 w-5" />}
				title="SDKs & Examples"
				subtitle="Complete, working examples in every major language. OMA is fully OpenAI-compatible — just swap the base URL."
			/>

			{/* Install commands */}
			<div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<div className="mb-2 flex items-center gap-2">
						<Terminal className="h-4 w-4 text-accent" />
						<span className="font-mono text-sm font-medium text-text">Python</span>
					</div>
					<code className="text-xs text-accent">pip install openai</code>
				</div>
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<div className="mb-2 flex items-center gap-2">
						<Terminal className="h-4 w-4 text-accent" />
						<span className="font-mono text-sm font-medium text-text">Node.js</span>
					</div>
					<code className="text-xs text-accent">npm install openai</code>
				</div>
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<div className="mb-2 flex items-center gap-2">
						<Terminal className="h-4 w-4 text-accent" />
						<span className="font-mono text-sm font-medium text-text">Go</span>
					</div>
					<code className="text-xs text-accent">go get github.com/sashabaranov/go-openai</code>
				</div>
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<div className="mb-2 flex items-center gap-2">
						<Terminal className="h-4 w-4 text-accent" />
						<span className="font-mono text-sm font-medium text-text">cURL</span>
					</div>
					<code className="text-xs text-text-muted">Built-in (no install)</code>
				</div>
			</div>

			{/* Chat Completion */}
			<div className="mb-10">
				<h3 className="mb-3 text-lg font-semibold text-text font-display flex items-center gap-2">
					<Sparkles className="h-5 w-5 text-accent" />
					Chat Completion
				</h3>
				<p className="mb-4 text-sm text-text-muted">
					Send a multi-turn chat request with system prompt, temperature control, and token limits.
				</p>
				<TabbedCode
					tabs={[
						{ label: "Python", lang: "python", code: pythonChatCode },
						{ label: "TypeScript", lang: "javascript", code: tsChatCode },
						{ label: "cURL", lang: "bash", code: curlChatCode },
						{ label: "Go", lang: "go", code: goChatCode },
					]}
				/>
			</div>

			{/* Streaming */}
			<div className="mb-10">
				<h3 className="mb-3 text-lg font-semibold text-text font-display flex items-center gap-2">
					<Zap className="h-5 w-5 text-orange" />
					Streaming
				</h3>
				<p className="mb-4 text-sm text-text-muted">
					Real-time token-by-token responses via Server-Sent Events. Add{" "}
					<code className="font-mono text-accent">&quot;stream&quot;: true</code> to your request.
				</p>
				<TabbedCode
					tabs={[
						{ label: "Python", lang: "python", code: pythonStreamCode },
						{ label: "TypeScript", lang: "javascript", code: tsStreamCode },
						{ label: "cURL", lang: "bash", code: curlStreamCode },
						{ label: "Go", lang: "go", code: goStreamCode },
					]}
				/>
			</div>

			{/* List Models */}
			<div className="mb-10">
				<h3 className="mb-3 text-lg font-semibold text-text font-display flex items-center gap-2">
					<BookOpen className="h-5 w-5 text-violet" />
					List Models
				</h3>
				<p className="mb-4 text-sm text-text-muted">
					Fetch the full model catalog with pricing and capabilities. No auth required for the public endpoint.
				</p>
				<TabbedCode
					tabs={[
						{ label: "Python", lang: "python", code: pythonModelsCode },
						{ label: "TypeScript", lang: "javascript", code: tsModelsCode },
						{ label: "cURL", lang: "bash", code: curlModelsCode },
						{ label: "Go", lang: "go", code: goModelsCode },
					]}
				/>
			</div>

			{/* Base URL callout */}
			<div className="mb-8 rounded-xl border border-accent/20 bg-accent/5 p-5">
				<div className="flex items-start gap-3">
					<Key className="h-5 w-5 text-accent mt-0.5" />
					<div>
						<h4 className="font-semibold text-accent">Base URL</h4>
						<p className="mt-1 text-sm text-text-muted">
							All examples use the same base URL. Just swap your API key and you&apos;re ready:
						</p>
						<code className="mt-2 inline-block rounded-lg bg-surface/80 border border-border/50 px-3 py-1.5 font-mono text-sm text-accent">
							https://api.oma-ai.com/v1
						</code>
					</div>
				</div>
			</div>

			{/* Vercel AI SDK */}
			<div className="rounded-xl border border-border bg-surface/50 p-5">
				<h4 className="mb-3 font-semibold text-text flex items-center gap-2">
					<Package className="h-4 w-4 text-accent" />
					Vercel AI SDK
				</h4>
				<p className="mb-4 text-sm text-text-muted">
					For Next.js and React apps, use the Vercel AI SDK with OMA as the provider:
				</p>
				<CodeBlock
					code={`import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const oma = createOpenAI({
  baseURL: 'https://api.oma-ai.com/v1',
  apiKey: 'oma_sk_your_key_here',
});

const { text } = await generateText({
  model: oma('deepseek-v3.2'),
  prompt: 'Explain quantum computing in one sentence.',
});

console.log(text);`}
					lang="javascript"
				/>
			</div>
		</AnimatedSection>
	);
}

function ErrorsSection() {
	const retryCode = `import time
from openai import OpenAI
client = OpenAI(api_key="oma_sk_...", base_url="https://api.oma-ai.com/v1")
for attempt in range(5):
    try:
        response = client.chat.completions.create(model="llama-3.2-3b", messages=[{"role": "user", "content": "Hi"}])
        break
    except Exception as e:
        if hasattr(e, 'status_code') and e.status_code == 429:
            time.sleep(2 ** attempt)
        else:
            raise`;

	return (
		<AnimatedSection delay={600}>
			<SectionHeading
				id="errors"
				icon={<AlertCircle className="h-5 w-5" />}
				title="Error Codes"
				subtitle="Standard HTTP status codes returned by the API."
			/>

			<div className="mb-6 overflow-hidden rounded-xl border border-border">
				<table className="w-full text-left text-sm">
					<thead>
						<tr className="border-b border-border bg-surface/50">
							<th className="px-4 py-3 font-medium text-text-muted">Code</th>
							<th className="px-4 py-3 font-medium text-text-muted">Type</th>
							<th className="px-4 py-3 font-medium text-text-muted">
								Description
							</th>
						</tr>
					</thead>
					<tbody>
						{ERROR_CODES.map((e) => (
							<tr key={e.code} className="border-b border-border/50">
								<td className="px-4 py-3 font-mono font-bold text-error">
									{e.code}
								</td>
								<td className="px-4 py-3 font-mono text-warning">{e.type}</td>
								<td className="px-4 py-3 text-text-muted">{e.desc}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="relative rounded-xl border border-border bg-panel p-5">
				<h4 className="mb-3 font-semibold text-text">Handling Rate Limits</h4>
				<CodeBlock code={retryCode} lang="python" />
			</div>
		</AnimatedSection>
	);
}

/* ==================== SIDEBAR ==================== */

function Sidebar({ activeId }: { activeId: string }) {
	const [mobileOpen, setMobileOpen] = useState(false);
	const mobileNavId = useId();

	return (
		<>
			<button
				type="button"
				onClick={() => setMobileOpen(!mobileOpen)}
				className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-void shadow-lg lg:hidden"
				aria-label={
					mobileOpen ? "Close navigation menu" : "Open navigation menu"
				}
				aria-expanded={mobileOpen}
				aria-controls={mobileNavId}
			>
				{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
			</button>

			{mobileOpen && (
				<button
					type="button"
					className="fixed inset-0 z-40 bg-void/80 backdrop-blur-sm lg:hidden cursor-default"
					onClick={() => setMobileOpen(false)}
					aria-label="Close navigation menu"
				/>
			)}

			<aside
				id={mobileNavId}
				aria-label="Mobile navigation"
				className={`fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-56 lg:w-64 overflow-y-auto border-r border-border bg-void transition-transform lg:translate-x-0 ${
					mobileOpen ? "translate-x-0" : "-translate-x-full"
				}`}
			>
				<div className="p-4">
					<div className="mb-4 rounded-xl bg-accent/10 p-3 border border-accent/20">
						<div className="flex items-center gap-2">
							<Terminal className="h-4 w-4 text-accent" />
							<span className="text-sm font-semibold text-accent">OMA API</span>
						</div>
						<p className="mt-1 text-xs text-text-muted">v1.0.0</p>
					</div>

					<nav className="space-y-1" aria-label="Documentation navigation">
						{NAV_ITEMS.map((item) => {
							const Icon = item.icon;
							const isActive = activeId === item.id;
							return (
								<a
									key={item.id}
									href={`#${item.id}`}
									onClick={() => setMobileOpen(false)}
									className={`flex items-center gap-3 rounded-lg px-3 py-3 min-h-[48px] text-sm transition-all ${
										isActive
											? "bg-accent/10 text-accent border border-accent/30"
											: "text-text-muted hover:bg-surface hover:text-text"
									}`}
									aria-current={isActive ? "page" : undefined}
								>
									<Icon className="h-4 w-4" />
									{item.label}
								</a>
							);
						})}
					</nav>
				</div>
			</aside>
		</>
	);
}

/* ==================== PAGE ==================== */

function DocsContent() {
	const [activeId, setActiveId] = useState("quickstart");

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) setActiveId(entry.target.id);
				});
			},
			{ rootMargin: "-20% 0px -70% 0px" },
		);
		NAV_ITEMS.forEach((item) => {
			const el = document.getElementById(item.id);
			if (el) observer.observe(el);
		});
		return () => observer.disconnect();
	}, []);

	return (
		<div className="min-h-screen">
			<Sidebar activeId={activeId} />

			<div className="lg:pl-64">
				<header className="sticky top-0 z-30 border-b border-border bg-void/80 backdrop-blur-xl">
					<div className="flex items-center justify-between px-4 py-3">
						<div className="flex items-center gap-3">
							<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20">
								<BookOpen className="h-4 w-4" />
							</div>
							<div className="flex flex-col">
								<nav
									aria-label="Breadcrumb"
									className="flex items-center gap-1.5 text-xs text-text-muted mb-0.5"
								>
									<Link href="/" className="hover:text-text transition-colors">
										Home
									</Link>
									<span className="opacity-50">›</span>
									<span className="text-text-secondary">Developer Portal</span>
									<span className="opacity-50">›</span>
									<span className="text-text">API Docs</span>
								</nav>
								<h1 className="font-semibold text-text text-sm">
									OMA AI Gateway Documentation
								</h1>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<DocsSearch />
							<Link
								href="/chat"
								className="btn-primary hidden sm:inline-flex items-center gap-2"
							>
								<Play className="h-4 w-4" />
								Chat
							</Link>
						</div>
					</div>
				</header>

				<div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
					<div className="mb-12">
						<h2 className="text-4xl font-bold tracking-tight text-text font-display mb-3">
							OMA API Documentation
						</h2>
						<p className="text-lg text-text-muted">
							OpenAI-compatible AI inference gateway with crypto payments.
							Access {MODEL_COUNT} models with unified API.
						</p>
					</div>

					<div className="space-y-16">
						<QuickStartSection />
						<AuthenticationSection />
						<EndpointsSection />
						<AvailableModelsSection />
						<StreamingSection />
						<RateLimitsSection />
						<PricingSection />
						<X402Section />
						<SDKsSection />
						<ErrorsSection />
					</div>
				</div>
			</div>
		</div>
	);
}

export default function DocsPage() {
	return <DocsContent />;
}
