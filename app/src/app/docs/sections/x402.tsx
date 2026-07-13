import { CheckCircle2, Zap } from "lucide-react";
import { AnimatedSection, CodeBlock, SectionHeading } from "./shared";

export function X402Section() {
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
							<CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />{" "}
							Base mainnet (USDC)
						</li>
						<li className="flex items-start gap-2">
							<CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />{" "}
							Base Sepolia (USDC, dev only)
						</li>
					</ul>
				</div>
			</div>
		</AnimatedSection>
	);
}
