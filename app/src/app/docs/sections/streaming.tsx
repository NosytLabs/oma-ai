import { Zap } from "lucide-react";
import { AnimatedSection, CodeBlock, SectionHeading, TabbedCode } from "./shared";

export function StreamingSection() {
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
  stream: true,
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
						<h3 className="font-semibold text-accent">Why Stream?</h3>
						<p className="mt-1 text-sm text-text-muted">
							Streaming provides real-time output as tokens are generated, reducing
							perceived latency from seconds to milliseconds. Essential for chat
							interfaces and interactive applications.
						</p>
					</div>
				</div>
			</div>

			<div id="stream-how" className="mb-6 scroll-mt-24">
				<h3 className="mb-3 text-sm font-semibold text-text">Enable Streaming</h3>
				<p className="mb-4 text-sm text-text-muted">
					Add <code className="font-mono text-accent">&quot;stream&quot;: true</code> to your request body.
					Responses arrive as Server-Sent Events (SSE) with <code className="font-mono text-accent">Content-Type: text/event-stream</code>.
				</p>
				<CodeBlock code={streamCode} lang="bash" title="Request with stream: true" />
			</div>

			<div id="stream-example" className="mb-6 scroll-mt-24">
				<h3 className="mb-3 text-sm font-semibold text-text">Stream Response Format</h3>
				<p className="mb-4 text-sm text-text-muted">
					Each event contains a <code className="font-mono text-accent">chat.completion.chunk</code> with
					a <code className="font-mono text-accent">delta</code> field containing partial content.
					The stream ends with <code className="font-mono text-accent">data: [DONE]</code>.
				</p>
				<CodeBlock code={streamResponse} lang="text" title="SSE Response Stream" />
			</div>

			<div id="stream-handling" className="rounded-xl border border-border bg-surface/50 p-5 scroll-mt-24">
				<h3 className="mb-3 font-semibold text-text">SDK Examples</h3>
				<TabbedCode
					tabs={[
						{ label: "Python", lang: "python", code: pythonStreamCode },
						{ label: "JavaScript", lang: "javascript", code: jsStreamCode },
					]}
				/>
			</div>

			<div className="mt-6 grid gap-4 sm:grid-cols-2">
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<h3 className="mb-2 font-semibold text-text">Streaming Headers</h3>
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
					<h3 className="mb-2 font-semibold text-text">Response Headers</h3>
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
