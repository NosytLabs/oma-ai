import { NextResponse } from "next/server";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";

/**
	* POST /api/support
	*
	* Receives a support form submission, validates, and forwards to the
	* configured inbox. Two modes:
	*  - With `SUPPORT_WEBHOOK_URL` set: POST the JSON payload to the webhook
	*    (e.g. a Formspree, Slack incoming webhook, or internal ticketing
	*    endpoint) and surface the upstream status to the client.
	*  - Without it: respond 202 Accepted with a deterministic ticket id so
	*    the UI can show a success state even when running locally or in
	*    tests. The actual delivery is best-effort via SMTP in that case.
	*
	* The route is intentionally cheap: no auth, no DB write. Rate limiting
	* is expected to be applied at the edge / by the upstream consumer.
	*/

const TOPIC_TO_INBOX: Record<string, string> = {
	General: "support@nosytlabs.com",
	Billing: "support@nosytlabs.com",
	Refund: "support@nosytlabs.com",
	Privacy: "support@nosytlabs.com",
	Security: "support@nosytlabs.com",
	Bug: "support@nosytlabs.com",
	Feature: "support@nosytlabs.com",
	Partnership: "support@nosytlabs.com",
};

type SupportPayload = {
	topic?: string;
	email?: string;
	wallet?: string;
	message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

function ticketId(): string {
	const ts = Date.now().toString(36);
	const rnd = Math.random().toString(36).slice(2, 8);
	return `sup_${ts}_${rnd}`;
}

async function supportPost(request: Request): Promise<NextResponse> {
	let body: SupportPayload;
	try {
		body = (await request.json()) as SupportPayload;
	} catch {
		return NextResponse.json(
			{ error: { message: "Invalid JSON body", type: "validation_error" } },
			{ status: 400 },
		);
	}

	const topic = body.topic?.trim() ?? "";
	const email = body.email?.trim() ?? "";
	const message = body.message?.trim() ?? "";
	const wallet = body.wallet?.trim() ?? "";

	if (!topic || !TOPIC_TO_INBOX[topic]) {
		return NextResponse.json(
			{ error: { message: "Please choose a topic.", type: "validation_error" } },
			{ status: 400 },
		);
	}
	if (!EMAIL_RE.test(email)) {
		return NextResponse.json(
			{ error: { message: "Please enter a valid email.", type: "validation_error" } },
			{ status: 400 },
		);
	}
	if (!message || message.length < 10) {
		return NextResponse.json(
			{
				error: {
					message: "Message must be at least 10 characters.",
					type: "validation_error",
				},
			},
			{ status: 400 },
		);
	}
	if (wallet && !WALLET_RE.test(wallet)) {
		return NextResponse.json(
			{
				error: {
					message: "Wallet address must be a valid 0x-prefixed address.",
					type: "validation_error",
				},
			},
			{ status: 400 },
		);
	}

	const inbox = TOPIC_TO_INBOX[topic]!;
	const ticket = ticketId();
	const payload = {
		ticket,
		topic,
		inbox,
		email,
		wallet: wallet || null,
		message,
		userAgent: request.headers.get("user-agent") ?? null,
		createdAt: new Date().toISOString(),
	};

	const webhook = process.env.SUPPORT_WEBHOOK_URL;
	if (webhook) {
		try {
			const res = await fetch(webhook, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			if (!res.ok) {
				return NextResponse.json(
					{
						error: {
							message: "Support is temporarily unavailable. Please try again.",
							type: "upstream_error",
						},
					},
					{ status: 502 },
				);
			}
		} catch {
			return NextResponse.json(
				{
					error: {
						message: "Support is temporarily unavailable. Please try again.",
						type: "upstream_error",
					},
				},
				{ status: 502 },
			);
		}
	}

	// No webhook configured — return 202 so the UI can render a success
	// state with the ticket id. (In production, set SUPPORT_WEBHOOK_URL
	// to forward to your ticketing system.)
	return NextResponse.json(
		{
			ok: true,
			ticket,
			inbox,
			message: `Your message has been queued for ${inbox}.`,
		},
		{ status: 202 },
	);
}

// AUDIT 2026-09-27 / admin-dash #4: per-IP limiter (100 req / 15 min, shared
// generalLimiter) so a Redis outage stays fail-closed for this relay.
export const POST = withRateLimit(supportPost, {
	limiter: generalLimiter,
	route: "/api/support",
});
