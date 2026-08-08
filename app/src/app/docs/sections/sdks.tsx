import { BookOpen, Key, Package, Sparkles, Terminal, Zap } from "lucide-react";
import { AnimatedSection, CodeBlock, SectionHeading, TabbedCode } from "./shared";

export function SDKsSection() {
	/* ── Chat Completion examples ── */
	const pythonChatCode = `from openai import OpenAI

client = OpenAI(
 api_key="oma_sk_your_key_here",
 base_url="https://api.oma-ai.com/v1"
)

response = client.chat.completions.create(
 model="llama-3.3-70b",
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
 model: "llama-3.3-70b",
 messages: [
 { role: "system", content: "You are a helpful assistant." },
 { role: "user", content: "Explain quantum computing in one sentence." },
 ],
 temperature: 0.7,
 max_tokens: 256,
});`;

	const curlChatCode = `curl https://api.oma-ai.com/v1/chat/completions \\
 -H "Authorization: Bearer oma_sk_your_key_here" \\
 -H "Content-Type: application/json" \\
 -d '{
 "model": "llama-3.3-70b",
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
		"model": "llama-3.3-70b",
		"messages": []map[string]string{
			{"role": "system", "content": "You are a helpful assistant."},
			{"role": "user", "content": "Explain quantum computing in one sentence."},
		},
		"temperature": 0.7,
		"max_tokens": 256,
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
 // Do something with model.id
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
				<div className="rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-4">
					<div className="mb-2 flex items-center gap-2">
						<Terminal className="h-4 w-4 text-accent" />
						<span className="font-mono text-sm font-medium text-text">Python</span>
					</div>
					<code className="text-xs text-accent">pip install openai</code>
				</div>
				<div className="rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-4">
					<div className="mb-2 flex items-center gap-2">
						<Terminal className="h-4 w-4 text-accent" />
						<span className="font-mono text-sm font-medium text-text">Node.js</span>
					</div>
					<code className="text-xs text-accent">npm install openai</code>
				</div>
				<div className="rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-4">
					<div className="mb-2 flex items-center gap-2">
						<Terminal className="h-4 w-4 text-accent" />
						<span className="font-mono text-sm font-medium text-text">Go</span>
					</div>
					<code className="text-xs text-accent">go get github.com/sashabaranov/go-openai</code>
				</div>
				<div className="rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-4">
					<div className="mb-2 flex items-center gap-2">
						<Terminal className="h-4 w-4 text-accent" />
						<span className="font-mono text-sm font-medium text-text">cURL</span>
					</div>
					<code className="text-xs text-text-muted">Built-in (no install)</code>
				</div>
			</div>

			{/* Chat Completion */}
			<div id="sdk-chat" className="mb-10 scroll-mt-24">
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
			<div id="sdk-stream" className="mb-10 scroll-mt-24">
				<h3 className="mb-3 text-lg font-semibold text-text font-display flex items-center gap-2">
					<Zap className="h-5 w-5 text-accent" />
					Streaming
				</h3>
				<p className="mb-4 text-sm text-text-muted">
					Real-time token-by-token responses via Server-Sent Events. Add{""}
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
			<div id="sdk-models" className="mb-10 scroll-mt-24">
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
			<div className="mb-8 rounded-[var(--radius-xl)] border border-accent/20 bg-accent/5 p-5">
				<div className="flex items-start gap-3">
					<Key className="h-5 w-5 text-accent mt-0.5" />
					<div>
						<h3 className="font-semibold text-accent">Base URL</h3>
						<p className="mt-1 text-sm text-text-muted">
							All examples use the same base URL. Just swap your API key and you&apos;re ready:
						</p>
						<code className="mt-2 inline-block rounded-[var(--radius-lg)] bg-surface/80 border border-border/50 px-3 py-1.5 font-mono text-sm text-accent">
							https://api.oma-ai.com/v1
						</code>
					</div>
				</div>
			</div>

			{/* Vercel AI SDK */}
			<div id="sdk-vercel" className="rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-5 scroll-mt-24">
				<h3 className="mb-3 font-semibold text-text flex items-center gap-2">
					<Package className="h-4 w-4 text-accent" />
					Vercel AI SDK
				</h3>
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
 model: oma('llama-3.3-70b'),
 prompt: 'Explain quantum computing in one sentence.',
});`}
					lang="javascript"
				/>
			</div>
		</AnimatedSection>
	);
}
