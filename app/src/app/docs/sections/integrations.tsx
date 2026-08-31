"use client";

import Link from "next/link";
import { Bot, Code2, Terminal } from "lucide-react";
import { AnimatedSection, CodeBlock, SectionHeading } from "./shared";
import { DOCS_EXAMPLE_MODEL } from "@/lib/model-utils";

/**
	* How to point popular agent CLIs / IDEs at OMA with a standard OpenAI-compatible
	* base URL + Bearer key. Keep model ids in sync with the live catalog.
	*/
export function IntegrationsSection() {
	const baseUrl = "https://api.oma-ai.com/v1";
	const model = DOCS_EXAMPLE_MODEL;

	return (
		<AnimatedSection>
			<SectionHeading
				id="integrations"
				icon={<Bot className="h-5 w-5" />}
				title="Agent & IDE integrations"
				subtitle="Use any OpenAI-compatible client: set base URL to api.oma-ai.com/v1 and Authorization: Bearer $OMA_KEY"
			/>

			<div className="mb-6 rounded-[var(--radius-xl)] border border-accent/25 bg-accent/5 p-4 text-sm text-text-secondary leading-relaxed">
				<p className="font-medium text-text-bright mb-1">One key, one base URL</p>
				<ul className="list-disc pl-5 space-y-1">
					<li>
						Base URL:{" "}
						<code className="font-mono text-accent text-xs">{baseUrl}</code>
					</li>
					<li>
						API key: create at{" "}
						<Link href="/dashboard?tab=api-keys" className="text-accent underline underline-offset-2 decoration-1 decoration-border-bright/70 transition-colors hover:text-accent-bright hover:decoration-accent">
							/dashboard → API keys
						</Link>{" "}
						(<code className="font-mono text-xs">oma_sk_…</code>)
					</li>
					<li>
						Default sample model:{" "}
						<code className="font-mono text-xs">{model}</code> (see{" "}
						<Link href="/models" className="text-accent underline underline-offset-2 decoration-1 decoration-border-bright/70 transition-colors hover:text-accent-bright hover:decoration-accent">
							/models
						</Link>
						)
					</li>
					<li>
						Claude Code / Anthropic SDK: also use{" "}
						<code className="font-mono text-xs">POST /v1/messages</code>
					</li>
					<li>
						<Link href="/agent-skill.md" className="text-accent underline underline-offset-2 decoration-1 decoration-border-bright/70 transition-colors hover:text-accent-bright hover:decoration-accent" target="_blank" rel="noopener noreferrer">
							System instructions
						</Link>
						: For custom agent setups, see our <code className="font-mono text-xs">agent-skill.md</code> file.
					</li>
				</ul>
			</div>

			<div id="int-opencode" className="mb-6 scroll-mt-24 rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-5">
				<h3 className="mb-2 flex items-center gap-2 font-semibold text-text">
					<Terminal className="h-4 w-4 text-accent" />
					OpenCode
				</h3>
				<p className="mb-3 text-sm text-text-muted">
					Point OpenCode at OMA as a custom OpenAI-compatible provider. Env vars are the
					portable path; project config can pin the model.
				</p>
				<CodeBlock
					lang="bash"
					code={`# ~/.bashrc / shell profile (or OpenCode env UI)
export OPENAI_API_KEY="oma_sk_your_key_here"
export OPENAI_BASE_URL="https://api.oma-ai.com/v1"

# Optional: default model for sessions
export OPENAI_MODEL="${model}"

# Then run OpenCode as usual — it will hit OMA for chat completions.`}
				/>
				<p className="mt-3 mb-3 text-xs text-text-muted">
					If your OpenCode build uses{" "}
					<code className="font-mono">OPENAI_API_BASE</code> instead of{" "}
					<code className="font-mono">OPENAI_BASE_URL</code>, set that to the same{" "}
					<code className="font-mono">{baseUrl}</code> value.
				</p>
				<p className="mb-2 text-sm text-text-secondary font-medium">
					Project config (optional)
				</p>
				<CodeBlock
					lang="json"
					code={`// opencode.json / provider settings (shape varies by OpenCode version)
{
	"provider": {
	"oma": {
	"npm": "@ai-sdk/openai-compatible",
	"name": "OMA",
	"options": {
	"baseURL": "${baseUrl}",
	"apiKey": "{env:OMA_API_KEY}"
	},
	"models": {
	"${model}": { "name": "${model}" }
	}
	}
	}
}`}
				/>
				<p className="mt-2 text-xs text-text-muted">
					Create the key at{" "}
					<Link href="/dashboard?tab=api-keys" className="text-accent underline underline-offset-2 decoration-1 decoration-border-bright/70 transition-colors hover:text-accent-bright hover:decoration-accent">
						/dashboard → API keys
					</Link>
					. Never commit <code className="font-mono">oma_sk_…</code> to git — use env vars.
				</p>
			</div>

			<div id="int-claude-code" className="mb-6 scroll-mt-24 rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-5">
				<h3 className="mb-2 flex items-center gap-2 font-semibold text-text">
					<Code2 className="h-4 w-4 text-accent" />
					Claude Code
				</h3>
				<p className="mb-3 text-sm text-text-muted">
					Claude Code talks the Anthropic Messages API. OMA exposes a compatible{" "}
					<code className="font-mono text-xs">POST /v1/messages</code> that rewrites to the
					same catalog. Configure a custom Anthropic base URL + key:
				</p>
				<CodeBlock
					lang="bash"
					code={`# Claude Code / Anthropic SDK env
export ANTHROPIC_API_KEY="oma_sk_your_key_here"
export ANTHROPIC_BASE_URL="https://api.oma-ai.com"

# Note: base URL is the origin (no /v1). The client appends /v1/messages.
# Model ids are OMA catalog ids (not anthropic/claude-3-5-sonnet):
# kimi-k3 · claude-opus-5 · llama-3.3-70b · …`}
				/>
				<CodeBlock
					lang="bash"
					code={`# One-shot smoke test (Messages API — x-api-key style)
curl https://api.oma-ai.com/v1/messages \\
	-H "x-api-key: oma_sk_your_key_here" \\
	-H "anthropic-version: 2023-06-01" \\
	-H "Content-Type: application/json" \\
	-d '{
	"model": "kimi-k3",
	"max_tokens": 64,
	"messages": [{"role": "user", "content": "ping"}]
	}'

# Same call with Bearer (OpenAI-style auth also accepted)
curl https://api.oma-ai.com/v1/messages \\
	-H "Authorization: Bearer oma_sk_your_key_here" \\
	-H "anthropic-version: 2023-06-01" \\
	-H "Content-Type: application/json" \\
	-d '{"model":"kimi-k3","max_tokens":64,"messages":[{"role":"user","content":"ping"}]}'`}
				/>
				<p className="mt-3 text-xs text-text-muted">
					Prefer one auth style consistently. Streaming: set{" "}
					<code className="font-mono">stream: true</code> — OMA returns Anthropic-shaped SSE.
					List models: <code className="font-mono">GET /v1/models</code> with the same key.
				</p>
			</div>

			<div id="int-cursor" className="mb-6 scroll-mt-24 rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-5">
				<h3 className="mb-2 font-semibold text-text">Cursor / Continue / Cline</h3>
				<p className="mb-3 text-sm text-text-muted">
					Any IDE that accepts an OpenAI-compatible endpoint:
				</p>
				<ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-text-secondary">
					<li>Open model / provider settings → Custom OpenAI</li>
					<li>
						API Base: <code className="font-mono text-xs">{baseUrl}</code>
					</li>
					<li>API Key: your <code className="font-mono text-xs">oma_sk_…</code></li>
					<li>
						Model: any id from <code className="font-mono text-xs">GET /v1/models</code>
					</li>
				</ol>
				<CodeBlock
					lang="json"
					code={`// Example Continue config snippet (~/.continue/config.json)
{
	"models": [
	{
	"title": "OMA ${model}",
	"provider": "openai",
	"model": "${model}",
	"apiBase": "${baseUrl}",
	"apiKey": "oma_sk_your_key_here"
	}
	]
}`}
				/>
			</div>

			<div id="int-openai-sdk" className="scroll-mt-24 rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-5">
				<h3 className="mb-2 font-semibold text-text">openai-python / openai-node</h3>
				<p className="mb-3 text-sm text-text-muted">
					Drop-in replacement — only change base URL and key:
				</p>
				<CodeBlock
					lang="python"
					code={`from openai import OpenAI

client = OpenAI(
	api_key="oma_sk_your_key_here",
	base_url="${baseUrl}",
)

r = client.chat.completions.create(
	model="${model}",
	messages=[{"role": "user", "content": "Hello from OMA"}],
	max_tokens=64,
)
print(r.choices[0].message.content)`}
				/>
			</div>
		</AnimatedSection>
	);
}
