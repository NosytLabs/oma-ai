import { Radio } from "lucide-react";
import { AnimatedSection, CodeBlock, SectionHeading } from "./shared";

export function WebhooksSection() {
	const sigCode = `# Polar standardwebhooks signature verification
# Headers: webhook-id, webhook-timestamp, webhook-signature
expected = base64(hmac_sha256(
	secret,
	f"{webhook_id}.{webhook_timestamp}.{raw_body}"
))
# Accept only if hmac.compare_digest(expected, sig_from_header)`;

	const payloadCode = `{
	"type": "order.paid",
	"data": {
		"id": "ord_...",
		"product": { "product_id": "..." },
		"customer": { "metadata": { "userId": "usr_..." } }
	}
}`;

	return (
		<AnimatedSection delay={600}>
			<SectionHeading
				id="webhooks"
				icon={<Radio className="h-5 w-5" />}
				title="Webhooks"
				subtitle="Receive signed Polar payment events for one-time credit-pack orders."
			/>

			<div id="wh-what" className="mb-6 scroll-mt-24">
				<h3 className="mb-3 font-semibold text-text">When to use them</h3>
				<p className="mb-3 text-sm text-text-muted">
					OMA sends signed webhook events when a one-time order or subscription
					changes state. The most common are{" "}
					<code className="font-mono text-accent">order.paid</code> (user was
					crediting their balance) and{" "}
					<code className="font-mono text-accent">order.refunded</code>. Events
					are delivered to the endpoint you configure on the dashboard.
				</p>
			</div>

			<div id="wh-endpoint" className="mb-6 scroll-mt-24">
				<h3 className="mb-3 font-semibold text-text">Endpoint</h3>
				<CodeBlock
					code={`POST /webhooks/polar   # (also served at /api/webhook/polar)`}
					lang="http"
				/>
				<p className="mt-3 text-sm text-text-muted">
					OMA verifies every request using the Polar standardwebhooks scheme
					before processing it. Requests with an invalid signature are rejected
					with <code className="font-mono text-accent">401 invalid_signature</code>{" "}
					and never credited.
				</p>
			</div>

			<div id="wh-sig" className="mb-6 scroll-mt-24">
				<h3 className="mb-3 font-semibold text-text">Signature verification</h3>
				<p className="mb-3 text-sm text-text-muted">
					Each request carries three headers —{" "}
					<code className="font-mono text-accent">webhook-id</code>,{" "}
					<code className="font-mono text-accent">webhook-timestamp</code>, and{" "}
					<code className="font-mono text-accent">webhook-signature</code>. The
					signature is HMAC-SHA256 over{" "}
					<code className="font-mono text-accent">id.timestamp.body</code>:
				</p>
				<CodeBlock code={sigCode} lang="python" />
			</div>

			<div id="wh-events" className="scroll-mt-24">
				<h3 className="mb-3 font-semibold text-text">Supported events</h3>
				<ul className="space-y-2 text-sm text-text-muted">
					<li>
						<code className="font-mono text-accent">order.paid</code> — credits{" "}
						credits to the user&apos;s balance (per the plan purchased).
					</li>
					<li>
						<code className="font-mono text-accent">order.refunded</code> — drains
						the credited amount from the user&apos;s balance.
					</li>
				</ul>
				<div className="mt-4">
					<CodeBlock code={payloadCode} lang="json" />
				</div>
				<p className="mt-3 text-sm text-text-muted">
					Events are idempotent — OMA deduplicates by{" "}
					<code className="font-mono text-accent">event.id</code>, so retried
					deliveries never double-credit.
				</p>
			</div>
		</AnimatedSection>
	);
}
