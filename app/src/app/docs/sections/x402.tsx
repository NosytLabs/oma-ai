import { CheckCircle2, Zap } from "lucide-react";
import { AnimatedSection, CodeBlock, SectionHeading } from "./shared";

export function X402Section() {
	const flowCode = `# 1. Sign a USDC transferWithAuthorization (EIP-3009) on Base for
# the treasury amount using viem, ethers, or any EIP-3009 signer.
# Gasless — the facilitator pays gas.

# 2. POST the envelope to /x402/verify — verified, settled, credited
curl https://api.oma-ai.com/x402/verify \\
	-H "Content-Type: application/json" \\
	-H 'PAYMENT-SIGNATURE: {"signature":"0x...","payload":{...}}'

# Response: 200 with a settlement receipt. Credits land as soon as
# settlement confirms — no card, no account signup dance.

# 3. Call chat completions with your API key as usual
curl https://api.oma-ai.com/v1/chat/completions \\
	-H "Content-Type: application/json" \\
	-H "Authorization: Bearer $OMA_KEY" \\
	-d '{"model":"llama-3.3-70b","messages":[{"role":"user","content":"Hello"}]}'

# Run dry mid-task? The API answers 402 Insufficient Credits — top up
# via the same /x402/verify envelope (or the /deposit page) and retry.`;

	const agentCode = `import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const account = privateKeyToAccount(process.env.AGENT_KEY);

// 1) Sign a USDC transferWithAuthorization (EIP-3009) to the OMA
// treasury for the amount you want to deposit.
// 2) POST the PaymentSignature envelope to /x402/verify — the server
// verifies the signature, settles on-chain, and credits your account.
// 3) Call /v1/chat/completions with your API key as usual; every
// request is metered against the credited balance.
//
// See https://x402.org for the protocol shape.

const payReq = await fetch('https://api.oma-ai.com/x402/verify', {
	method: 'POST',
	headers: {
	'Content-Type': 'application/json',
	'PAYMENT-SIGNATURE': JSON.stringify({ signature, payload }),
	},
});

if (payReq.ok) {
	// Credits land as soon as settlement confirms.
	const res = await fetch('https://api.oma-ai.com/v1/chat/completions', {
	method: 'POST',
	headers: {
	'Content-Type': 'application/json',
	Authorization: ['Bearer', process.env.OMA_KEY].join(' '),
	},
	body: JSON.stringify({
	model: 'deepseek-v4-flash-0731-openbroker',
	messages: [{ role: 'user', content: 'Write a smart contract' }],
	}),
	});
}`;

	return (
		<AnimatedSection delay={450}>
			<SectionHeading
				id="x402"
				icon={<Zap className="h-5 w-5" />}
				title="x402 Payments"
				subtitle="USDC top-ups on Base via the x402 payment envelope. Wallet-based, no card needed."
			/>

			<div id="x402-what" className="rounded-[var(--radius-xl)] border border-warning/20 bg-warning/5 p-4 mb-6 scroll-mt-24">
				<div className="flex items-start gap-3">
					<Zap className="h-5 w-5 text-warning mt-0.5" />
					<div>
						<h3 className="font-semibold text-warning">
							x402 — Crypto-Native Settlement
						</h3>
						<p className="mt-1 text-sm text-text-muted">
							Agents fund with USDC on Base and no card. Sign a USDC{" "}
							<code className="text-accent font-mono">
								transferWithAuthorization
							</code>{" "}
							(EIP-3009) — gasless, the facilitator pays gas — and POST
							the{" "}
							<code className="text-accent font-mono">PAYMENT-SIGNATURE</code>{" "}
							envelope per the{" "}
							<a
								href="https://x402.org"
								target="_blank"
								rel="noopener noreferrer"
								className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
							>
								x402 protocol
							</a>{" "}
							to{" "}
							<code className="text-accent font-mono">POST /x402/verify</code>.
							The server verifies, settles on-chain, and credits the
							account — no human in the loop. Then call chat completions
							with an API key as usual. Run dry mid-task and the API
							answers 402 Insufficient Credits — top up the same way and
							retry. Payments can also be sent as a base64{" "}
							<code className="text-accent font-mono">X-PAYMENT</code> header;
							settled requests return{" "}
							<code className="text-accent font-mono">X-PAYMENT-RESPONSE</code>.
						</p>
					</div>
				</div>
			</div>

			<div id="x402-flow" className="mb-6 scroll-mt-24">
				<h3 className="mb-3 text-sm font-semibold text-text">
					Deposit → Spend Flow
				</h3>
				<CodeBlock code={flowCode} lang="bash" />
			</div>

			<div id="x402-code" className="rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-5 scroll-mt-24">
				<h3 className="mb-3 font-semibold text-text">For AI Agents</h3>
				<p className="text-sm text-text-muted mb-4">
					Use <code className="text-accent font-mono">viem</code> or{" "}
					<code className="text-accent font-mono">ethers</code> directly to
					sign USDC payment authorizations. No first-party SDK is required.
					An agent holding a funded Base wallet can top up its own credits and
					keep working — no human in the loop.
				</p>
				<p className="text-sm text-text-muted mb-4">
					Setting up an agent (Claude Code, Cursor, custom script)? Give it{" "}
					<a
						href="/agent-skill.md"
						className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
					>
						agent-skill.md
					</a>{" "}
					— a copy-paste instruction file that teaches an agent to use OMA
					autonomously (API key flow, x402 pay-per-request, and cost
					guidance), including an optional self-verification step.
				</p>
				<CodeBlock code={agentCode} lang="javascript" />
			</div>

			<div id="x402-where" className="mt-6 grid gap-4 sm:grid-cols-2 scroll-mt-24">
				<div className="rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-4">
					<h3 className="mb-2 font-semibold text-text">Benefits</h3>
					<ul className="space-y-1.5 text-sm text-text-muted">
						<li className="flex items-start gap-2">
							<CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />{" "}
							Gasless USDC deposits (EIP-3009)
						</li>
						<li className="flex items-start gap-2">
							<CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />{" "}
							Wallet-based, no card or bank account needed
						</li>
						<li className="flex items-start gap-2">
							<CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />{" "}
							Standard x402 protocol envelope
						</li>
					</ul>
				</div>
				<div className="rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-4">
					<h3 className="mb-2 font-semibold text-text">Supported Networks</h3>
					<ul className="space-y-1.5 text-sm text-text-muted">
						<li className="flex items-start gap-2">
							<CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />{" "}
							Base mainnet (USDC)
						</li>
					</ul>
				</div>
			</div>
		</AnimatedSection>
	);
}
