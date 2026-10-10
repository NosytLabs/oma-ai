import { Key, Mail, Shield } from "lucide-react";
import Link from "next/link";
import { AnimatedSection, SectionHeading, TabbedCode } from "./shared";

export function AuthenticationSection() {
	const pythonCode = `from openai import OpenAI
client = OpenAI(
	api_key="oma_sk_your_key_here",
	base_url="https://www.oma-ai.com/api/v1"
)
response = client.chat.completions.create(
	model="llama-3.3-70b",
	messages=[{"role": "user", "content": "Hello!"}]
)`;

	const jsCode = `import { OpenAI } from "openai";
const client = new OpenAI({
	apiKey: "oma_sk_your_key_here",
	baseURL: "https://www.oma-ai.com/api/v1"
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
	client.BaseURL = "https://www.oma-ai.com/api/v1"
}`;

	return (
		<AnimatedSection delay={100}>
			<SectionHeading
				id="authentication"
				icon={<Key className="h-5 w-5" />}
				title="Authentication"
				subtitle="Programmatic inference uses a Bearer API key. Website accounts use email or wallet sessions; eligible free website chat also works without sign-in."
			/>
			<p className="mb-6 text-sm text-text-muted">
				Your <Link href="/dashboard" className="text-accent underline underline-offset-2">dashboard</Link> contains credits, full-range usage and API keys.
				{" "}<Link href="/dashboard?tab=settings" className="text-accent underline underline-offset-2">Account settings</Link> manages your profile, appearance, active sessions and data.
				{" "}Expand a request in Usage to copy its request ID when reporting an issue. Account deletion requires a fresh sign-in and forfeits remaining credits.
			</p>

			<div
				id="auth-free-chat"
				className="rounded-[var(--radius-xl)] border border-accent/20 bg-accent/5 p-4 mb-6 scroll-mt-24"
			>
				<h3 className="font-semibold text-accent text-sm mb-2">
					Free OMA-AI models (website chat)
				</h3>
			<p className="text-sm text-text-muted mb-2">
				Eligible OMA-AI models can be used on <code className="text-accent font-mono text-xs">/chat</code>{" "}
				without an API key or wallet (20 msgs/day anonymous, 100/day signed-in), subject to live model availability. The chat model selector shows the current free options. Prepaid credits cover paid requests; rate limits still apply.
			</p>
			<p className="text-sm text-text-muted">
				API-key calls (<code className="text-accent font-mono text-xs">Authorization: Bearer oma_sk_…</code>) always spend credits, including models eligible for free website chat. Free usage applies to browser website chat only, never to programmatic API traffic.
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
						code: `curl https://www.oma-ai.com/api/v1/chat/completions \\
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
						<li>Create an API key in the dashboard and save it when shown</li>
						<li>Credits can be added via USDC on Base (card when Polar is enabled)</li>
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
						<li>Create an API key in the dashboard and save it when shown</li>
						<li>Use the key with any OpenAI-compatible SDK</li>
					</ol>
				</div>
			</div>


		</AnimatedSection>
	);
}
