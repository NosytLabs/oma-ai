/**
	* Shared API response types for the oma-ai frontend.
	* Mirrors the shapes returned by the Hono backend in `server/src/routes/`.
	*/

// ─── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
	id: string;
	email: string;
	emailVerified: boolean;
	name: string;
	image?: string | null;
	createdAt: string;
	updatedAt?: string;
	isAnonymous?: boolean | null;
	// OMA extensions (mirrored from Better Auth's additionalFields in
	// server/src/auth.ts).
	evmAddress?: string | null;
	/** Whether TOTP 2FA is enabled on the account (placeholder for future). */
	twoFactorEnabled?: boolean;
	/** Number of unused backup codes remaining after 2FA setup. */
	backupCodesRemaining?: number;
	/** ISO timestamp of last password change (null for wallet-only accounts). */
	lastPasswordChange?: string | null;
}

export interface ApiKey {
	id: string;
	name: string;
	prefix: string;
	createdAt: string;
	lastUsedAt: string | null;
}

export interface ApiKeyWithSecret extends ApiKey {
	key: string;
}

// ─── Credits / Balance / Usage ────────────────────────────────────────────────

export interface BalanceResponse {
	balanceCents: string;
	totalDepositedCents: string;
	totalUsedCents: string;
	lastActivityAt: string | null;
}

/**
	* One row from GET /v1/usage/recent.
	* Token counts are numbers; all cents fields are decimal strings (may be
	* sub-cent, e.g. "0.03"). `latencyMs` is null for in-flight/failed requests.
	*/
export interface UsageRecord {
	id: string;
	requestId: string;
	model: string;
	provider: string;
	promptTokens: number;
	completionTokens: number;
	/** Upstream provider cost in cents (decimal string). */
	costCents: string;
	/** OMA markup in cents (decimal string). */
	markupCents: string;
	/** Amount billed to the user in cents (decimal string). */
	totalCents: string;
	latencyMs: number | null;
	/** "completed" | "error" | "free_tier" | future values. */
	status: string;
	createdAt: string;
}

export interface CreditBatch {
	id: string;
	amountCents: string;
	remainingCents: string;
	expiresAt: string;
	paymentMethod: string | null;
}

export interface AutoReloadSettings {
	enabled: boolean;
	thresholdCents: number;
	reloadAmountCents: number;
	spendLimitCents: number;
	paymentMethod: string;
}

// ─── Models ───────────────────────────────────────────────────────────────────

export interface Model {
	id: string;
	object: string;
	created: number;
	owned_by: string;
	pricing?: {
		prompt: string;
		completion: string;
	};
}

export interface ModelsResponse {
	object: "list";
	data: Model[];
}

// ─── Deposit ──────────────────────────────────────────────────────────────────

// ─── Inference / Chat ─────────────────────────────────────────────────────────

export interface HealthResponse {
	status: "ok" | "degraded" | string;
	version: string;
	service: string;
	uptime: number;
	correlationId: string;
	checks: Record<
		string,
		{
			status: "ok" | "degraded" | "rate_limited" | "circuit_open" | string;
			latency?: number;
			cooldownMs?: number;
		}
	>;
}

// ─── x402 payment protocol ────────────────────────────────────────────────────

// ─── Sessions ─────────────────────────────────────────────────────────────────

export interface Session {
	id: string;
	createdAt: string;
	expiresAt: string;
	userAgent: string | null;
	ipAddress: string | null;
	isCurrent: boolean;
}
