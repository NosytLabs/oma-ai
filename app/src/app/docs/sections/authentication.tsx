import { CheckCircle2, Key, Shield } from "lucide-react";
import { AnimatedSection, SectionHeading, TabbedCode } from "./shared";

export function AuthenticationSection() {
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
				<div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
					<h4 className="font-semibold text-accent text-sm mb-2">How it works</h4>
					<ol className="list-decimal list-inside space-y-1.5 text-sm text-text-muted">
						<li>Click &quot;Connect Wallet&quot; on the login page</li>
						<li>Sign a SIWE message with your wallet (no gas cost)</li>
						<li>Your API key is generated automatically on first sign-in</li>
						<li>Use the key with any OpenAI-compatible SDK</li>
					</ol>
				</div>
			</div>

			{/* ── Account Number Login ── */}
			<div id="auth-account" className="mt-8 scroll-mt-24">
				<h3 className="text-lg font-semibold text-text font-display flex items-center gap-2 mb-3">
					<Key className="h-5 w-5 text-accent" />
					Account Number Login
				</h3>
				<p className="text-sm text-text-muted mb-4">
					No wallet? No problem. Create an account with just a username — a unique
					account number is issued and linked to your API key. Credits are managed
					via USDC deposits to your on-chain address.
				</p>
				<div className="grid gap-4 sm:grid-cols-2 mb-4">
					<div className="rounded-xl border border-border bg-surface/50 p-4">
						<h4 className="font-semibold text-text text-sm mb-2">Flow</h4>
						<ol className="list-decimal list-inside space-y-1 text-sm text-text-muted">
							<li>Create an account via the login page</li>
							<li>Receive a unique <code className="text-accent font-mono text-xs">oma-xxxx</code> account number</li>
							<li>Deposit USDC on Base to your on-chain address</li>
							<li>Use the generated API key with any OpenAI-compatible SDK</li>
						</ol>
					</div>
					<div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
						<h4 className="font-semibold text-accent text-sm mb-2">When to use</h4>
						<ul className="space-y-1 text-sm text-text-muted">
							<li className="flex items-start gap-2">
								<CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
								AI agents running in server environments
							</li>
							<li className="flex items-start gap-2">
								<CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
								Teams without crypto wallets
							</li>
							<li className="flex items-start gap-2">
								<CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
								Automated CI/CD pipelines
							</li>
						</ul>
					</div>
				</div>
			</div>
		</AnimatedSection>
	);
}
