import dynamic from "next/dynamic";
import { Play, Terminal } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { AnimatedSection, CodeBlock, SectionHeading, QUICK_START_STEPS } from "./shared";

const AgentSessionDemo = dynamic(
	() =>
		import("@/components/marketing/AgentSessionDemo").then(
			(m) => m.AgentSessionDemo,
		),
	{
		ssr: false,
		loading: () => (
			<Skeleton className="h-[320px] w-full rounded-xl border border-border" />
		),
	},
);

export function QuickStartSection() {
	const curlCode = `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.2-3b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;

	// Compact per-modality curl blocks. Each block's code defaults to a
	// bash snippet; the placeholder blocks for music/upscale/inpaint use
	// comments because those Venice endpoints aren't yet wired up on
	// /v1/* (they live on Venice directly — see references).
	function ModalityExample({ title, code }: { title: string; code: string }) {
		const looksLikeCurl = code.trimStart().startsWith("curl");
		return (
			<div className="rounded-lg border border-border bg-surface/50 p-4">
				<div className="mb-2 flex items-center justify-between">
					<span className="text-xs font-semibold text-text-secondary font-mono uppercase tracking-wider">
						{title}
					</span>
					{looksLikeCurl && (
						<span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-mono text-accent border border-accent/20">
							cURL
						</span>
					)}
				</div>
				<pre className="overflow-x-auto rounded-md bg-void/40 p-3 text-[11px] leading-snug font-mono text-text-secondary whitespace-pre">
{code}
				</pre>
			</div>
		);
	}

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
						id={step.id}
						className="rounded-xl border border-border bg-surface/50 p-5 scroll-mt-24"
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

			{/* Per-modality examples — copyable from the docs page so users see
			    all 9 supported modalities at a glance. Each block uses the
			    OpenAI-compatible surface so SDKs work out-of-the-box. */}
			<div className="mt-10 space-y-4">
				<p className="text-xs font-mono uppercase tracking-widest text-text-muted">
					All 9 modalities · curl
				</p>
				<div className="grid gap-3 md:grid-cols-2">
					<ModalityExample
						title="Chat"
						code={`curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.2-3b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}
					/>
					<ModalityExample
						title="Image generation"
						code={`curl https://api.oma-ai.com/v1/images/generations \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "venice-sd35",
    "prompt": "a serene mountain lake at dawn"
  }'`}
					/>
					<ModalityExample
						title="Video generation"
						code={`curl https://api.oma-ai.com/v1/videos/quote \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "kling-v3-pro-text-to-video",
    "duration": "5s"
  }'`}
					/>
					<ModalityExample
						title="Text-to-speech"
						code={`curl https://api.oma-ai.com/v1/audio/speech \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "tts-kokoro",
    "input": "Hello from OMA Voice",
    "voice": "af_sky"
  }' --output speech.mp3`}
					/>
					<ModalityExample
						title="Speech-to-text"
						code={`curl https://api.oma-ai.com/v1/audio/transcriptions \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -F "model=openai/whisper-large-v3" \\
  -F "file=@recording.mp3"`}
					/>
					<ModalityExample
						title="Embeddings"
						code={`curl https://api.oma-ai.com/v1/embeddings \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "text-embedding-bge-m3",
    "input": "Open Model Access"
  }'`}
					/>
					<ModalityExample
						title="Music generation"
						code={`# Available via Venice — request with model id from
# GET /v1/models?category=music. Pricing is per track.`}
					/>
					<ModalityExample
						title="Image upscale / edit"
						code={`# Image upscale and inpaint available via Venice. Browse
# GET /v1/models?category=upscale or ?category=inpaint for the
# current catalog and pricing per image.`}
					/>
				</div>
			</div>

			{/* Brainless-inspired agent session — OMA-themed marketing demo */}
			<div className="mt-10">
				<p className="mb-3 text-xs font-mono uppercase tracking-widest text-text-muted">
					Agent session · visual demo
				</p>
				<AgentSessionDemo />
			</div>
		</AnimatedSection>
	);
}
