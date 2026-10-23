import type { MiddlewareHandler } from "hono";
import type { OmaEnv } from "../types.js";
import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { logger } from "../lib/logger.js";

/** Shared by both API formats. Postgres admits one worker without holding a connection during inference. */
export function inferenceIdempotency(): MiddlewareHandler<OmaEnv> {
	return async (c, next) => {
		const userId = c.get("userId");
		if (!userId) { await next(); return; }
		const body = await c.req.json().catch(() => null);
		const rawKey = c.req.header("Idempotency-Key")?.trim() || body?.idempotency_key;
		if (rawKey === undefined || rawKey === null || rawKey === "") { await next(); return; }
		if (typeof rawKey !== "string" || !rawKey.trim() || Buffer.byteLength(rawKey.trim(), "utf8") > 512) {
			return c.json({ error: { type: "invalid_request_error", code: "invalid_idempotency_key", message: "Idempotency-Key must be a non-empty string of at most 512 bytes." } }, 400);
		}
		const keyHash = createHash("sha256").update(rawKey.trim()).digest("hex");
		const requestId = `idem-${randomUUID()}`;
		const conflict = (completed: boolean, priorRequestId: string) => {
			if (!completed) c.header("Retry-After", "5");
			return c.json({ error: {
				type: "idempotency_conflict", code: completed ? "already_processed" : "request_in_progress", request_id: priorRequestId,
				message: completed ? "This idempotency key was already processed. Completion bodies are not retained for replay; use the response saved by your client." : "A request with this idempotency key is still running. Wait before retrying with the same key.",
			} }, 409);
		};
		try {
			// Preserve the completed-key contract for records created before this guard.
			const legacyId = `idem-${userId}-${keyHash}`;
			const legacy = await db.execute(sql`SELECT request_id FROM usage_records WHERE user_id=${userId} AND request_id=${legacyId} AND status='completed' LIMIT 1`);
			if (legacy.rows.length) return conflict(true, legacyId);
			const admitted = await db.execute(sql`
				INSERT INTO inference_request_claims (user_id,key_hash,request_id,state,expires_at)
				VALUES (${userId},${keyHash},${requestId},'pending',NOW()+INTERVAL '5 minutes')
				ON CONFLICT (user_id,key_hash) DO UPDATE SET request_id=EXCLUDED.request_id, expires_at=EXCLUDED.expires_at, created_at=NOW()
				WHERE inference_request_claims.state='pending' AND inference_request_claims.expires_at<=NOW()
				AND NOT EXISTS (SELECT 1 FROM usage_records WHERE request_id=inference_request_claims.request_id AND status IN ('completed','free_tier'))
				AND NOT EXISTS (SELECT 1 FROM inference_credit_reservations WHERE request_id=inference_request_claims.request_id AND state IN ('held','reconciliation'))
				RETURNING request_id`);
			if (!admitted.rows.length) {
				const prior = await db.execute(sql`SELECT request_id, state, EXISTS (SELECT 1 FROM usage_records WHERE request_id=inference_request_claims.request_id AND status IN ('completed','free_tier')) AS billed
					FROM inference_request_claims WHERE user_id=${userId} AND key_hash=${keyHash}`);
				const row = prior.rows[0];
				return conflict(row?.state === "completed" || row?.billed === true, String(row?.request_id ?? requestId));
			}
		} catch (err) {
			logger.error({ err }, "[inference] idempotency admission unavailable");
			return c.json({ error: { type: "server_error", code: "idempotency_unavailable", message: "Request retry protection is temporarily unavailable. Retry with the same key." } }, 503);
		}
		c.set("inferenceRequestId", requestId);
		let finalized = false;
		async function finalize(completed: boolean) {
			if (finalized) return;
			finalized = true;
			try {
				if (completed) await db.execute(sql`UPDATE inference_request_claims SET state='completed' WHERE request_id=${requestId}`);
				// Delivery can fail after billing committed. Keep that key held so
				// retrying an ambiguous response cannot issue a second charge.
				else await db.execute(sql`DELETE FROM inference_request_claims WHERE request_id=${requestId} AND state='pending'
					AND NOT EXISTS (SELECT 1 FROM usage_records WHERE request_id=${requestId} AND status IN ('completed','free_tier'))
					AND NOT EXISTS (SELECT 1 FROM inference_credit_reservations WHERE request_id=${requestId} AND state IN ('held','reconciliation'))`);
			} catch (err) { logger.warn({ err, requestId }, "[inference] retry claim finalization failed; claim remains held"); }
		}
		try { await next(); } catch (err) { await finalize(false); throw err; }
		if (!c.res.ok) { await finalize(false); return; }
		if (!c.res.headers.get("Content-Type")?.includes("text/event-stream") || !c.res.body) { await finalize(true); return; }
		const reader = c.res.body.getReader();
		let terminated = false;
		const guarded = new ReadableStream<Uint8Array>({
			async pull(controller) {
				if (terminated) return;
				try {
					const { done, value } = await reader.read();
					if (terminated) return;
					if (done) { terminated = true; const outcome = c.get("inferenceOutcome"); await finalize(outcome !== "error" && outcome !== "aborted"); controller.close(); }
					else controller.enqueue(value);
				} catch (err) { if (!terminated) { terminated = true; await finalize(false); controller.error(err); } }
			},
			async cancel(reason) { if (terminated) return; terminated = true; try { await reader.cancel(reason); } finally { await finalize(false); } },
		});
		c.res = new Response(guarded, c.res);
	};
}
