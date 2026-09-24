import { CheckCircle2, Zap } from "lucide-react";
import { AnimatedSection, CodeBlock, SectionHeading } from "./shared";

const flowCode = `# 1. Obtain an EIP-3009 USDC authorization for the OMA treasury.
# The authorization is signed by the wallet; it does not send a transaction.

# 2. Verify the authorization. A 200 response only means it is valid.
curl https://www.oma-ai.com/api/x402/verify \\
  -H "Content-Type: application/json" \\
  -H 'PAYMENT-SIGNATURE: {"signature":"0x...","payload":{...}}'

# 3. With an authenticated OMA session, settle the verified authorization.
# Use the txHash and networkId returned by verification; amount is server-derived.
curl https://www.oma-ai.com/api/x402/settle \\
  -H "Content-Type: application/json" \\
  -H "Cookie: <your-session-cookie>" \\
  -d '{"txHash":"0x...","networkId":"base"}'

# 4. Wait for the settlement receipt, then use the credited balance normally.`;

export function X402Section() {
  return (
    <AnimatedSection delay={450}>
      <SectionHeading
        id="x402"
        icon={<Zap className="h-5 w-5" />}
        title="x402 Payments"
        subtitle="USDC settlement on Base using an EIP-3009 authorization."
      />

      <div id="x402-what" className="mb-6 rounded-[var(--radius-xl)] border border-warning/20 bg-warning/5 p-4 scroll-mt-24">
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <h3 className="font-semibold text-warning">Agent-native USDC settlement</h3>
            <p className="mt-1 text-sm text-text-muted">
              x402 is an optional, advanced flow for agents that can create EIP-3009 USDC authorizations.
              Standard dashboard deposits remain the simplest way to add credits.
            </p>
          </div>
        </div>
      </div>

      <div id="x402-flow" className="scroll-mt-24">
        <h3 className="font-display text-lg font-semibold text-text">How settlement works</h3>
        <ol className="mt-3 space-y-3 text-sm text-text-muted">
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />Sign an authorization for the configured OMA treasury address and the required USDC amount.</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />Call <code className="font-mono text-accent">/x402/verify</code>. This validates the envelope but does not credit an account.</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />Call <code className="font-mono text-accent">/x402/settle</code> from an authenticated OMA session. Settlement is idempotent and the amount is derived from the verified record.</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />Use the receipt and credited balance for subsequent API requests.</li>
        </ol>
      </div>

      <div id="x402-code" className="mt-8 scroll-mt-24">
        <h3 className="font-display text-lg font-semibold text-text">Request sequence</h3>
        <p className="mt-2 text-sm text-text-muted">Keep private keys and signed payment envelopes out of browser code, logs, and source control.</p>
        <CodeBlock lang="bash" code={flowCode} />
      </div>

      <div id="x402-where" className="mt-8 rounded-[var(--radius-xl)] border border-border bg-surface p-4 scroll-mt-24">
        <h3 className="font-display text-lg font-semibold text-text">Supported network</h3>
        <p className="mt-2 text-sm text-text-muted">Base mainnet only. The settlement service validates the configured USDC contract and treasury address before accepting a payment.</p>
      </div>
    </AnimatedSection>
  );
}
