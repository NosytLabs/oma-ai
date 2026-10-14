import { CheckCircle2, Zap } from "lucide-react";
import Link from "next/link";
import { AnimatedSection, CodeBlock, SectionHeading } from "./shared";

const flowCode = `# Sign in via SIWE with the wallet that owns the USDC first.
# PAYMENT_SIGNATURE is a base64-encoded, signed v2 envelope.
# Calling verify broadcasts a transfer; it is not a dry run.
set -e
curl --fail-with-body -X POST https://www.oma-ai.com/x402/verify \\
  -H "Content-Type: application/json" \\
  -H "PAYMENT-SIGNATURE: $PAYMENT_SIGNATURE" > verification.json
jq -e '.valid == true' verification.json > /dev/null

# Credit the confirmed transfer to the same wallet's OMA account.
# Reuse the returned txHash and networkId; do not submit an amount.
jq '{txHash, networkId}' verification.json | \\
  curl --fail-with-body https://www.oma-ai.com/x402/settle \\
    -H "Content-Type: application/json" \\
    --cookie "$OMA_SESSION_COOKIE" \\
    --data-binary @-

# A successful response includes settled, receipt, and creditedCents.
# Now use that account's API key to spend the prepaid balance.`;

const envelopeCode = `{
  "x402Version": 2,
  "accepted": {
    "scheme": "exact",
    "network": "eip155:8453",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amount": "1000000",
    "payTo": "<payTo from /x402/info>",
    "maxTimeoutSeconds": 300,
    "extra": { "name": "USD Coin", "version": "2" }
  },
  "payload": {
    "signature": "<0x-prefixed 65-byte signature>",
    "authorization": {
      "from": "<payer wallet address>",
      "to": "<same configured treasury address>",
      "value": "1000000",
      "validAfter": "<Unix seconds>",
      "validBefore": "<Unix seconds>",
      "nonce": "<0x-prefixed 32-byte random nonce>"
    }
  }
}`;

export function X402Section() {
  return (
    <AnimatedSection delay={450}>
      <SectionHeading
        id="x402"
        icon={<Zap className="h-5 w-5" />}
        title="x402 Payments"
        subtitle="Fund prepaid credits with a signed USDC authorization on Base."
      />

      <div id="x402-what" className="mb-6 rounded-[var(--radius-xl)] border border-warning/20 bg-warning/5 p-4 scroll-mt-24">
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <h3 className="font-semibold text-warning">Verification moves funds</h3>
            <p className="mt-1 text-sm text-text-muted">
              Calling /x402/verify validates the EIP-3009 authorization, broadcasts the USDC
              transfer, and waits for confirmation. It is not a dry run. Sign in with the
              paying wallet before starting; /x402/settle credits only the SIWE session
              whose linked wallet matches the USDC payer.
            </p>
          </div>
        </div>
      </div>

      <div id="x402-flow" className="scroll-mt-24">
		<p className="mb-4 text-sm leading-relaxed text-text-muted">New funding returns 503 when crypto payments are paused or payment availability cannot be checked. Honor Retry-After when present. If a transfer already confirmed, retry /x402/settle with its existing hash and the payer’s session; a funding pause does not require another payment.</p>
        <h3 className="font-display text-lg font-semibold text-text">How funding works</h3>
        <ol className="mt-3 space-y-3 text-sm text-text-muted">
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />Sign in via SIWE with the USDC payer wallet. Read payTo from /x402/info, then sign that recipient, the intended amount, and a fresh nonce. The direct-deposit address can differ.</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />POST the signed envelope to /x402/verify. The facilitator pays gas and transfers the authorized USDC; save the returned transaction hash.</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />POST the hash and network to /x402/settle with the paying wallet’s session cookie. This credits the confirmed payment once, preserving fractional credits. An API key does not authenticate this endpoint.</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />Use the account’s API key for inference against the prepaid balance. Ordinary chat requests do not issue a mid-request x402 challenge.</li>
        </ol>
      </div>

      <div id="x402-code" className="mt-8 scroll-mt-24">
        <h3 className="font-display text-lg font-semibold text-text">Payment signature and request sequence</h3>
        <p className="mt-2 text-sm text-text-muted">
          Send base64-encoded JSON in PAYMENT-SIGNATURE. The v2 accepted fields specify
          the exact scheme, Base network, USDC asset, treasury, and atomic amount. The
          accepted amount and payTo must match authorization.value and authorization.to.
          The example below represents 1 USDC; replace every placeholder before signing.
        </p>
        <CodeBlock lang="json" code={envelopeCode} />
        <p className="mt-3 text-sm text-text-muted">
          Sign EIP-712 TransferWithAuthorization using the USDC domain: USD Coin,
          version 2, chain ID 8453, and the Base USDC contract. Times are Unix seconds,
          value is an integer string of atomic USDC units (6 decimals per token), and nonce is a fresh 32-byte value. Legacy raw-JSON
          PAYMENT-SIGNATURE envelopes and the older base64 X-PAYMENT header remain supported.
        </p>
        <CodeBlock lang="bash" code={flowCode} />
        <p className="mt-3 text-sm text-text-muted">
          These shell examples require curl and jq. Keep private keys, session cookies,
          and signed payment envelopes out of logs and source control. The public funding
          URLs use /x402/*; the SDK base URL is https://www.oma-ai.com/api/v1.
        </p>
      </div>

      <div className="mt-8 rounded-[var(--radius-xl)] border border-border bg-surface p-4">
        <h3 className="font-display text-lg font-semibold text-text">Retry crediting with the same transaction</h3>
        <p className="mt-2 text-sm text-text-muted">
          If funds moved but credits are pending, retry /x402/settle with the same hash and
          payer session. Crediting is idempotent and can recover the payer and amount from
          the confirmed USDC Transfer log after a server restart. A successful response
          includes a signed receipt string and creditedCents; PAYMENT-RESPONSE carries a
          base64 receipt summary.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          A verification timeout can include a txHash even when valid is false. Check its
          Base receipt before authorizing another payment. Once confirmed, settle that hash.
          If no hash was returned, reconcile the signed nonce and wallet activity first.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          A 409 payment_already_credited or payment_reconciliation_required response is
          not retryable. Contact support with the transaction hash if reconciliation
          is required. Do not authorize a replacement payment to resolve that conflict.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Background on the protocol status code lives in the{" "}
          <Link href="/glossary/http-status-402" className="text-accent underline underline-offset-2 hover:text-accent/80">HTTP 402 status code</Link>{" "}
          glossary entry, including the x402 challenge-response lifecycle and how{" "}
          <Link href="/glossary/eip-3009" className="text-accent underline underline-offset-2 hover:text-accent/80">EIP-3009</Link>{" "}
          TransferWithAuthorization is used to settle the payment.
        </p>
      </div>

      <div id="x402-where" className="mt-8 rounded-[var(--radius-xl)] border border-border bg-surface p-4 scroll-mt-24">
        <h3 className="font-display text-lg font-semibold text-text">Supported network</h3>
        <p className="mt-2 text-sm text-text-muted">
          Base mainnet only (eip155:8453), using USDC. The service pins the USDC contract
          and configured treasury. Settlement accepts networkId base or eip155:8453 and
          derives the amount from verified payment evidence rather than a caller-supplied amount.
        </p>
        <h3 className="mt-5 font-display text-lg font-semibold text-text">Your wallet and the treasury</h3>
        <p className="mt-2 text-sm text-text-muted">
          OMA does not create or hold a wallet for you. Use your own wallet for sign-in and
          USDC funding. The website supports installed browser wallets such as MetaMask,
          Rabby and Coinbase Wallet. Choose a wallet offered by sign-in or Buy credits;
          mobile and QR pairing is available when WalletConnect is listed.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Direct USDC deposits use the address shown on the deposit page and require Base
          gas in your sending wallet. x402 uses the recipient advertised by /x402/info,
          with gas paid by the facilitator. A confirmed payment becomes prepaid account
          credits; it does not give the treasury access to your wallet or API key.
        </p>
      </div>
    </AnimatedSection>
  );
}
