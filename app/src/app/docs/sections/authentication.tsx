import { Key, Mail, Shield } from "lucide-react";
import { AnimatedSection, SectionHeading, TabbedCode } from "./shared";

export function AuthenticationSection() {
	const pythonCode = `from openai import OpenAI
client = OpenAI(
	api_key="oma_sk_your_key_here",
	base_url="https://api.oma-ai.com/v1"
)
response = client.chat.completions.create(
	model="llama-3.3-70b",
	messages=[{"role": "user", "content": "Hello!"}]
)`;

	const jsCode = `import OpenAI from "openai";
const client = new OpenAI({
	apiKey: "oma_sk_your_key_here",
	baseURL: "https://api.oma-ai.com/v1"
});
const response = await client.chat.completions.create({
	model: "llama-3.3-70b",
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
				subtitle="Paid models and the public API need a Bearer API key (or wallet session). Free OMA-AI website chat does not."
			/>

			<div
				id="auth-free-chat"
				className="rounded-[var(--radius-xl)] border border-accent/20 bg-accent/5 p-4 mb-6 scroll-mt-24"
			>
				<h3 className="font-semibold text-accent text-sm mb-2">
					Free OMA-AI models (website chat)
				</h3>
				<p className="text-sm text-text-muted mb-2">
					Budget models in the OMA-AI catalog
					(<code className="text-accent font-mono text-xs">provider: oma-ai</code>
					) — e.g. <code className="text-accent font-mono text-xs">gemini-3-flash-preview</code>,{" "}
					<code className="text-accent font-mono text-xs">deepseek-v4-flash-0731-openbroker</code> — can be
					used on <code className="text-accent font-mono text-xs">/chat</code>{" "}
					without sign-in, API key, or wallet. Rate limits still apply. Upgrade to a paid plan to unlock the entire Venice catalog, unlimited concurrency, and dedicated throughput.
				</p>
				<p className="text-sm text-text-muted">
					Programmatic API access to free models still works with a key if you
					prefer; unauthenticated requests to{" "}
					<code className="text-accent font-mono text-xs">/v1/chat/completions</code>{" "}
					are accepted only for free OMA-AI model ids.
				</p>
			</div>

			<div id="auth-key" className="rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-5 mb-6 scroll-mt-24">
				<div className="mb-3 text-sm text-text-muted">Authorization Header (paid API)</div>
				<div className="rounded-[var(--radius-lg)] bg-surface/80 border border-border/50 p-3 font-mono text-sm">
					<span className="text-warning">Authorization: </span>
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
	-d '{"model":"llama-3.3-70b","messages":[{"role":"user","content":"Hello"}]}'`,
					},
					{ label: "Python", lang: "python", code: pythonCode },
					{ label: "JavaScript", lang: "javascript", code: jsCode },
					{ label: "Go", lang: "go", code: goCode },
				]}
			/>

			<div className="mt-6 rounded-[var(--radius-xl)] border border-warning/20 bg-warning/5 p-4">
				<div className="flex items-start gap-3">
					<Shield className="h-5 w-5 text-warning mt-0.5" />
					<div>
						<h3 className="font-semibold text-warning">API Key Security</h3>
						<p className="mt-1 text-sm text-text-muted">
							Keys use the{" "}
							<code className="text-warning font-mono">oma_sk_</code> prefix.
							Only the SHA-256 hash is stored. Keep your key secret and never
							commit it to version control.
						</p>
					</div>
				</div>
			</div>

			{/* ── Email Magic Link Auth ── */}
			<div id="auth-magic" className="mt-8 scroll-mt-24">
				<h3 className="text-lg font-semibold text-text font-display flex items-center gap-2 mb-3">
					<Mail className="h-5 w-5 text-accent" />
					Email Magic Link
				</h3>
				<p className="text-sm text-text-muted mb-4">
					Sign in with a passwordless magic link sent to your inbox. No password to leak,
					no password reset loops. 
				</p>
				<div className="rounded-[var(--radius-xl)] border border-accent/20 bg-accent/5 p-4">
					<h3 className="font-semibold text-accent text-sm mb-2">How it works</h3>
					<ol className="list-decimal list-inside space-y-1.5 text-sm text-text-muted">
						<li>Enter your email address on the login page</li>
						<li>Click the link sent to your inbox within 5 minutes</li>
						<li>Your API key is generated automatically on first sign-in</li>
						<li>Credits can be added via card or USDC (Base) in your dashboard</li>
					</ol>
				</div>
			</div>

			{/* ── Wallet (SIWE) Auth ── */}
			<div id="auth-wallet" className="mt-8 scroll-mt-24">
				<h3 className="text-lg font-semibold text-text font-display flex items-center gap-2 mb-3">
					<Shield className="h-5 w-5 text-accent" />
					Wallet Auth (SIWE)
				</h3>
				<p className="text-sm text-text-muted mb-4">
					Connect any EVM wallet using Sign-In with Ethereum (SIWE). No email, no
					password. Your wallet address is your identity.
				</p>
				<div className="rounded-[var(--radius-xl)] border border-accent/20 bg-accent/5 p-4">
					<h3 className="font-semibold text-accent text-sm mb-2">How it works</h3>
					<ol className="list-decimal list-inside space-y-1.5 text-sm text-text-muted">
						<li>Click &quot;Connect Wallet&quot; on the login page</li>
						<li>Sign a SIWE message with your wallet (no gas cost)</li>
						<li>Your API key is generated automatically on first sign-in</li>
						<li>Use the key with any OpenAI-compatible SDK</li>
					</ol>
				</div>
			</div>


		</AnimatedSection>
	);
}
