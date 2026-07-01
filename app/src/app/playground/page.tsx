"use client";

import {
	Copy,
	Eye,
	EyeOff,
	Loader2,
	Send,
	Shell,
	Terminal,
	X,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { MODELS } from "@/lib/models-data";

type TabId = "curl" | "python" | "node";

interface CodeSnippet {
	label: string;
	code: string;
}

const API_BASE = "https://api.oma-ai.com";
const ENDPOINT = "/v1/chat/completions";

function generateSnippets(opts: {
	apiKey: string;
	model: string;
	systemPrompt: string;
	message: string;
	temperature: number;
	maxTokens: number;
	stream: boolean;
}): Record<TabId, CodeSnippet> {
	const { apiKey, model, systemPrompt, message, temperature, maxTokens, stream } = opts;
	const maskedKey = apiKey ? `${apiKey.slice(0, 8)}...` : "YOUR_API_KEY";

	const messages = [];
	if (systemPrompt.trim()) {
		messages.push({ role: "system", content: systemPrompt });
	}
	messages.push({ role: "user", content: message || "Hello, world!" });

	const payload = JSON.stringify(
		{
			model,
			messages,
			temperature,
			max_tokens: maxTokens,
			stream,
		},
		null,
		2,
	);

	return {
		curl: {
			label: "cURL",
			code: `curl -X POST ${API_BASE}${ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${maskedKey}" \\
  -d '${payload.replace(/\n/g, "\\\n  ")}'`,
		},
		python: {
			label: "Python",
			code: `import requests

response = requests.post(
    "${API_BASE}${ENDPOINT}",
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer ${maskedKey}",
    },
    json=${payload.split("\n").map((l, i) => (i === 0 ? l : "    " + l)).join("\n")},
)

print(response.json())`,
		},
		node: {
			label: "Node.js",
			code: `const response = await fetch("${API_BASE}${ENDPOINT}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${maskedKey}",
  },
  body: JSON.stringify(${payload.split("\n").map((l, i) => (i === 0 ? l : "    " + l)).join("\n")}),
});

const data = await response.json();`,
		},
	};
}

function parseSSEBlock(block: string): string[] {
	if (!block || block.trim() === "") return [];
	const lines = block.split("\n");
	const data: string[] = [];
	for (const line of lines) {
		if (!line || line.startsWith(":")) continue;
		const colon = line.indexOf(":");
		const field = colon === -1 ? line : line.slice(0, colon);
		const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
		if (field === "data") data.push(value);
	}
	return data;
}

export default function PlaygroundPage() {
	const [apiKey, setApiKey] = useState("");
	const [showApiKey, setShowApiKey] = useState(false);
	const [model, setModel] = useState("deepseek-v3.2");
	const [systemPrompt, setSystemPrompt] = useState("");
	const [message, setMessage] = useState("");
	const [temperature, setTemperature] = useState(0.7);
	const [maxTokens, setMaxTokens] = useState(1024);
	const [stream, setStream] = useState(true);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [response, setResponse] = useState("");
	const [activeTab, setActiveTab] = useState<TabId>("curl");
	const [copied, setCopied] = useState(false);
	const [responseCopied, setResponseCopied] = useState(false);

	const abortRef = useRef<AbortController | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const selectedModel = useMemo(
		() => MODELS.find((m) => m.id === model),
		[model],
	);

	const snippets = useMemo(
		() =>
			generateSnippets({
				apiKey,
				model,
				systemPrompt,
				message,
				temperature,
				maxTokens,
				stream,
			}),
		[apiKey, model, systemPrompt, message, temperature, maxTokens, stream],
	);

	const sendRequest = useCallback(async () => {
		if (!apiKey.trim()) {
			setError("API key is required");
			return;
		}
		if (!message.trim()) {
			setError("Message is required");
			return;
		}

		setLoading(true);
		setError(null);
		setResponse("");

		const abortController = new AbortController();
		abortRef.current = abortController;

		const messages = [];
		if (systemPrompt.trim()) {
			messages.push({ role: "system", content: systemPrompt.trim() });
		}
		messages.push({ role: "user", content: message.trim() });

		try {
			const res = await fetch(`${API_BASE}${ENDPOINT}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey.trim()}`,
				},
				body: JSON.stringify({
					model,
					messages,
					temperature,
					max_tokens: maxTokens,
					stream,
					...(stream ? { stream_options: { include_usage: true } } : {}),
				}),
				signal: abortController.signal,
			});

			if (!res.ok) {
				let errMsg = `HTTP ${res.status}: ${res.statusText}`;
				try {
					const errBody = await res.json();
					if (errBody?.error?.message) errMsg = errBody.error.message;
				} catch {}
				throw new Error(errMsg);
			}

			if (stream && res.body) {
				const reader = res.body.getReader();
				const decoder = new TextDecoder();
				let accumulated = "";
				let sseBuffer = "";

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					sseBuffer += decoder.decode(value, { stream: true });

					const normalized = sseBuffer.replace(/\r\n/g, "\n");
					const parts = normalized.split("\n\n");
					sseBuffer = parts.pop() ?? "";

					for (const block of parts) {
						const dataLines = parseSSEBlock(block);
						for (const d of dataLines) {
							if (d.trim() === "[DONE]") continue;
							try {
								const parsed = JSON.parse(d);
								const delta = parsed.choices?.[0]?.delta?.content;
								if (delta) accumulated += delta;
							} catch {}
						}
					}

					if (accumulated) setResponse(accumulated);
				}

				if (sseBuffer.trim()) {
					const dataLines = parseSSEBlock(sseBuffer);
					for (const d of dataLines) {
						if (d.trim() === "[DONE]") continue;
						try {
							const parsed = JSON.parse(d);
							const delta = parsed.choices?.[0]?.delta?.content;
							if (delta) accumulated += delta;
						} catch {}
					}
					setResponse(accumulated);
				}
			} else {
				const data = await res.json();
				const content = data.choices?.[0]?.message?.content || "";
				setResponse(content);
			}
		} catch (err: unknown) {
			if (err instanceof Error && err.name === "AbortError") {
				// User cancelled
			} else if (err instanceof TypeError) {
				setError("Network error — check your connection");
			} else if (err instanceof Error) {
				setError(err.message);
			} else {
				setError("Unknown error");
			}
		} finally {
			setLoading(false);
		}
	}, [apiKey, model, systemPrompt, message, temperature, maxTokens, stream]);

	const stopGeneration = useCallback(() => {
		abortRef.current?.abort();
		setLoading(false);
	}, []);

	const copySnippet = useCallback(async () => {
		const code = snippets[activeTab].code;
		await navigator.clipboard.writeText(code);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [snippets, activeTab]);

	const copyResponse = useCallback(async () => {
		await navigator.clipboard.writeText(response);
		setResponseCopied(true);
		setTimeout(() => setResponseCopied(false), 2000);
	}, [response]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				if (!loading) sendRequest();
			}
		},
		[loading, sendRequest],
	);

	return (
		<div className="min-h-dvh w-full bg-void text-text font-sans">
			{/* Header */}
			<div className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-20">
				<div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
							<Terminal className="w-4 h-4 text-accent" />
						</div>
						<div>
							<h1 className="text-sm font-semibold text-text font-mono tracking-wide uppercase">
								API Playground
							</h1>
							<p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
								OpenAI-Compatible Endpoint
							</p>
						</div>
					</div>
					<a
						href="/docs"
						className="text-xs text-text-muted hover:text-accent transition-colors font-mono"
					>
						Docs →
					</a>
				</div>
			</div>

			<div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Left: Request Config */}
					<div className="space-y-5">
						{/* API Key */}
						<div className="space-y-2">
							<label
								htmlFor="api-key"
								className="block text-[10px] font-mono text-text-muted uppercase tracking-widest"
							>
								Authorization
							</label>
							<div className="relative">
								<input
									id="api-key"
									type={showApiKey ? "text" : "password"}
									value={apiKey}
									onChange={(e) => setApiKey(e.target.value)}
									placeholder="Bearer sk-..."
									className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-text font-mono placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent/30 focus:outline-none"
								/>
								<button
									type="button"
									onClick={() => setShowApiKey(!showApiKey)}
									className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text transition-colors"
									aria-label={showApiKey ? "Hide API key" : "Show API key"}
								>
									{showApiKey ? (
										<EyeOff className="w-4 h-4" />
									) : (
										<Eye className="w-4 h-4" />
									)}
								</button>
							</div>
							<p className="text-[10px] text-text-muted font-mono">
								{API_BASE}
								{ENDPOINT}
							</p>
						</div>

						{/* Model Selector */}
						<div className="space-y-2">
							<label
								htmlFor="model-select"
								className="block text-[10px] font-mono text-text-muted uppercase tracking-widest"
							>
								Model
							</label>
							<select
								id="model-select"
								value={model}
								onChange={(e) => setModel(e.target.value)}
								className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text font-mono focus:border-accent focus:ring-1 focus:ring-accent/30 focus:outline-none appearance-none cursor-pointer"
							>
								{MODELS.map((m) => (
									<option key={m.id} value={m.id}>
										{m.name} — {m.provider} · {m.tier}
									</option>
								))}
							</select>
							{selectedModel && (
								<div className="flex flex-wrap gap-2">
									<span className="text-[10px] font-mono text-text-muted">
										{selectedModel.contextLength} ctx
									</span>
									<span className="text-[10px] text-text-muted">·</span>
									<span className="text-[10px] font-mono text-text-muted">
										${selectedModel.inputPricePer1M}/M in
									</span>
									<span className="text-[10px] text-text-muted">·</span>
									<span className="text-[10px] font-mono text-text-muted">
										${selectedModel.outputPricePer1M}/M out
									</span>
									{selectedModel.capabilities.map((cap) => (
										<span
											key={cap}
											className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20"
										>
											{cap}
										</span>
									))}
								</div>
							)}
						</div>

						{/* System Prompt */}
						<div className="space-y-2">
							<label
								htmlFor="system-prompt"
								className="block text-[10px] font-mono text-text-muted uppercase tracking-widest"
							>
								System Prompt
								<span className="ml-2 text-text-tertiary normal-case tracking-normal">
									(optional)
								</span>
							</label>
							<textarea
								id="system-prompt"
								value={systemPrompt}
								onChange={(e) => setSystemPrompt(e.target.value)}
								placeholder="You are a helpful assistant..."
								rows={3}
								className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text font-mono placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent/30 focus:outline-none resize-y"
								style={{ minHeight: "72px", maxHeight: "160px" }}
							/>
						</div>

						{/* User Message */}
						<div className="space-y-2">
							<label
								htmlFor="user-message"
								className="block text-[10px] font-mono text-text-muted uppercase tracking-widest"
							>
								User Message
							</label>
							<textarea
								id="user-message"
								ref={textareaRef}
								value={message}
								onChange={(e) => setMessage(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="What would you like to ask?"
								rows={5}
								className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text font-mono placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent/30 focus:outline-none resize-y"
								style={{ minHeight: "120px" }}
							/>
							<p className="text-[10px] text-text-muted font-mono">
								[⌘/Ctrl + Enter] Send
							</p>
						</div>

						{/* Parameters */}
						<div className="space-y-4 p-4 bg-surface/50 border border-border rounded-lg">
							<div className="flex items-center justify-between">
								<span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">
									Parameters
								</span>
								<label className="flex items-center gap-2 cursor-pointer group">
									<span className="text-[10px] font-mono text-text-muted">
										Stream
									</span>
									<input
										type="checkbox"
										checked={stream}
										onChange={(e) => setStream(e.target.checked)}
										className="sr-only peer"
									/>
									<div className="w-8 h-4 rounded-full bg-surface-elevated border border-border peer-checked:bg-accent/30 peer-checked:border-accent/50 transition-colors relative">
										<div
											className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-text-muted transition-all ${stream ? "translate-x-4 bg-accent" : ""}`}
										/>
									</div>
								</label>
							</div>

							{/* Temperature */}
							<div className="space-y-1.5">
								<div className="flex items-center justify-between">
									<label
										htmlFor="temperature"
										className="text-[10px] font-mono text-text-muted"
									>
										Temperature
									</label>
									<span className="text-xs font-mono text-accent tabular-nums">
										{temperature.toFixed(2)}
									</span>
								</div>
								<input
									id="temperature"
									type="range"
									min="0"
									max="2"
									step="0.01"
									value={temperature}
									onChange={(e) => setTemperature(Number(e.target.value))}
									className="w-full accent-accent"
								/>
								<div className="flex justify-between text-[9px] font-mono text-text-tertiary">
									<span>0.00</span>
									<span>1.00</span>
									<span>2.00</span>
								</div>
							</div>

							{/* Max Tokens */}
							<div className="space-y-1.5">
								<div className="flex items-center justify-between">
									<label
										htmlFor="max-tokens"
										className="text-[10px] font-mono text-text-muted"
									>
										Max Tokens
									</label>
									<span className="text-xs font-mono text-accent tabular-nums">
										{maxTokens}
									</span>
								</div>
								<input
									id="max-tokens"
									type="range"
									min="1"
									max="8192"
									step="1"
									value={maxTokens}
									onChange={(e) => setMaxTokens(Number(e.target.value))}
									className="w-full accent-accent"
								/>
								<div className="flex justify-between text-[9px] font-mono text-text-tertiary">
									<span>1</span>
									<span>4096</span>
									<span>8192</span>
								</div>
							</div>
						</div>

						{/* Send Button */}
						{loading ? (
							<button
								type="button"
								onClick={stopGeneration}
								className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-error/10 border border-error/30 text-error text-sm font-mono font-semibold rounded-lg hover:bg-error/20 transition-colors"
							>
								<X className="w-4 h-4" />
								Stop Generation
							</button>
						) : (
							<button
								type="button"
								onClick={sendRequest}
								disabled={!apiKey.trim() || !message.trim()}
								className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent text-void text-sm font-mono font-semibold rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed glow-accent-sm hover:shadow-[0_0_20px_var(--color-accent-glow)]"
							>
								<Send className="w-4 h-4" />
								Send Request
							</button>
						)}
					</div>

					{/* Right: Response & Code Snippets */}
					<div className="space-y-5">
						{/* Response */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">
									Response
								</span>
								{response && (
									<button
										type="button"
										onClick={copyResponse}
										className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted hover:text-accent transition-colors"
									>
										<Copy className="w-3 h-3" />
										{responseCopied ? "Copied!" : "Copy"}
									</button>
								)}
							</div>
							<div className="min-h-[300px] bg-surface border border-border rounded-lg p-4 overflow-auto">
								{loading && !response && (
									<div className="flex items-center gap-2 text-text-muted text-sm font-mono">
										<Loader2 className="w-4 h-4 animate-spin text-accent" />
										Waiting for response...
									</div>
								)}
								{error && (
									<div className="p-3 bg-error/10 border border-error/30 rounded-lg">
										<p className="text-sm font-mono text-error">{error}</p>
									</div>
								)}
								{response ? (
									<pre className="text-sm font-mono text-text-secondary whitespace-pre-wrap break-words">
										{response}
										{loading && (
											<span className="inline-block w-2 h-4 bg-accent/60 animate-pulse ml-0.5 align-text-bottom" />
										)}
									</pre>
								) : (
									!loading &&
									!error && (
										<div className="flex flex-col items-center justify-center h-full min-h-[250px] text-center">
											<Shell className="w-8 h-8 text-border-bright mb-3" />
											<p className="text-sm text-text-muted font-mono">
												Enter your API key and message, then send a request
											</p>
										</div>
									)
								)}
							</div>
						</div>

						{/* Code Snippets */}
						<div className="space-y-2">
							<span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">
								Code
							</span>
							<div className="bg-surface border border-border rounded-lg overflow-hidden">
								{/* Tabs */}
								<div className="flex border-b border-border">
									{(["curl", "python", "node"] as TabId[]).map((tabId) => (
										<button
											key={tabId}
											type="button"
											onClick={() => setActiveTab(tabId)}
											className={`flex-1 px-3 py-2 text-[10px] font-mono uppercase tracking-wider transition-colors ${
												activeTab === tabId
													? "text-accent border-b-2 border-accent bg-accent/5"
													: "text-text-muted hover:text-text-secondary border-b-2 border-transparent"
											}`}
										>
											{tabId === "node" ? "Node.js" : tabId.toUpperCase()}
										</button>
									))}
								</div>

								{/* Code Content */}
								<div className="relative">
									<pre className="p-4 text-[11px] font-mono text-text-secondary overflow-x-auto max-h-[300px] overflow-y-auto">
										<code>{snippets[activeTab].code}</code>
									</pre>
									<button
										type="button"
										onClick={copySnippet}
										className="absolute top-2 right-2 p-1.5 rounded bg-surface-elevated border border-border text-text-muted hover:text-accent hover:border-accent/30 transition-colors"
										aria-label="Copy code snippet"
									>
										<Copy className="w-3.5 h-3.5" />
										{copied && (
											<span className="absolute -top-6 right-0 text-[9px] font-mono text-accent whitespace-nowrap">
												Copied!
											</span>
										)}
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
