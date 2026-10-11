import { NextResponse } from "next/server";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";
import { BodyTooLargeError, readTextWithinLimit } from "@/lib/read-body";

/**
	* POST /api/support
	*
	* Receives a support form submission, validates, and forwards to the
	* configured webhook. A missing or failing transport returns an error,
	* never a fictitious queued ticket. The route has no database queue or
	* SMTP fallback. Submissions are validated and rate-limited below.
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
		body = JSON.parse(await readTextWithinLimit(request, 64 * 1024)) as SupportPayload;
	} catch (error) {
		if (error instanceof BodyTooLargeError) return NextResponse.json({ error: {
			message:"Support request is too large.", type:"payload_too_large",
		} }, { status:413 });
		return NextResponse.json(
			{ error: { message: "Invalid JSON body", type: "validation_error" } },
			{ status: 400 },
		);
	}
	if (!body || typeof body !== "object" || Array.isArray(body) ||
		["topic", "email", "message", "wallet"].some(key => {
			const value = body[key as keyof SupportPayload];
			return value !== undefined && typeof value !== "string";
		})) {
		return NextResponse.json({ error: { message: "Invalid support fields.", type: "validation_error" } }, { status: 400 });
	}

	const topic = body.topic?.trim() ?? "";
	const email = body.email?.trim() ?? "";
	const message = body.message?.trim() ?? "";
	const wallet = body.wallet?.trim() ?? "";

	if (!Object.hasOwn(TOPIC_TO_INBOX, topic)) {
		return NextResponse.json(
			{ error: { message: "Please choose a topic.", type: "validation_error" } },
			{ status: 400 },
		);
	}
	if (email.length > 254 || !EMAIL_RE.test(email)) {
		return NextResponse.json(
			{ error: { message: "Please enter a valid email.", type: "validation_error" } },
			{ status: 400 },
		);
	}
	if (message.length < 10 || message.length > 10_000) {
		return NextResponse.json(
			{
				error: {
					message: "Message must contain 10 to 10,000 characters.",
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
	const webhook = process.env.SUPPORT_WEBHOOK_URL;
	if (!webhook) {
		return NextResponse.json({ error: {
			message: "Your message could not be delivered. Email support@nosytlabs.com instead.",
			type: "service_unavailable",
		} }, { status: 503 });
	}
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

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 10_000);
	try {
		const res = await fetch(webhook, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
			signal: controller.signal,
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
			{ error: {
				message: "Support is temporarily unavailable. Please try again.",
				type: "upstream_error",
			} },
			{ status: 502 },
		);
	} finally {
		clearTimeout(timer);
	}

	// The delivery service acknowledged this request.
	return NextResponse.json(
		{
			ok: true,
			ticket,
			inbox,
			message: "Your support request was received.",
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
