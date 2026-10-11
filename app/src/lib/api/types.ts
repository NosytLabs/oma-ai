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
	/** ISO timestamp of last password change (null for wallet-only accounts). */
	lastPasswordChange?: string | null;
}

export interface ApiKey {
	id: string;
	name: string;
	prefix: string;
	createdAt: string;
	lastUsedAt: string | null;
	expiresAt?: string | null;
	allowedModels?: string[] | null;
	ipAllowlist?: string[] | null;
}

export interface ApiKeyCreateOptions {
	expiresInDays?: number;
	allowedModels?: string[];
	ipAllowlist?: string[];
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
	* One row from GET /v1/usage.
	* Token counts are numbers; all cents fields are decimal strings (may be
	* sub-cent, e.g. "0.03"). `latencyMs` is null for in-flight/failed requests.
	*/
export interface UsageRecord {
	id: string;
	requestId: string;
	/** API key row id for Bearer oma_sk_* calls; null for web/session traffic. */
	apiKeyId: string | null;
	model: string;
	provider: string;
	requestedModel?: string | null;
	/** Original charge is totalCents; billedCents excludes refunded charges. */
	billedCents?: string;
	refundedAt?: string | null;
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

export interface UsageTotals {
	requests: number;
	errors: number;
	aborted: number;
	free_requests: number;
	active_models: number;
	input_tokens: number;
	output_tokens: number;
	billed_cents: string;
	avg_latency_ms: number | null;
}

export interface UsageModelSummary {
	model: string;
	requests: number;
	input_tokens: number;
	output_tokens: number;
	billed_cents: string;
	avg_latency_ms: number | null;
}

export interface UsageSummary {
	range: "24h" | "7d" | "30d" | "all";
	timezone: string;
	bucket: "day" | "month";
	from: string | null;
	to: string;
	lifetimeRequests: number;
	totals: UsageTotals;
	last24h: UsageTotals;
	models: UsageModelSummary[];
	providers: Array<{ provider: string; requests: number; billed_cents: string }>;
	timeline: Array<{ date: string; requests: number; billed_cents: string }>;
}

export interface CreditBatch {
	id: string;
	amountCents: string;
	remainingCents: string;
	expiresAt: string;
	paymentMethod: string | null;
}

// ─── Models ───────────────────────────────────────────────────────────────────

export interface Model {
	id: string;
	object: string;
	created: number;
	owned_by: string;
	/**
	 * Whether this model is currently serving requests. The upstream catalog
	 * sets `false` for models whose provider credential is missing or whose
	 * upstream is saturated — those pages render but error on use, so
	 * anything that advertises availability (hero count, sitemap) must
	 * filter on this rather than assuming every catalog entry is live.
	 */
	available?: boolean;
	display_name?: string;
	provider?: string;
	category?: string;
	modality?: string;
	context_length?: number;
	supports_streaming?: boolean;
	supports_tools?: boolean;
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

// (HealthResponse removed — only used by the deleted `/ready` deep widget.
// The navbar / login status chip reads a boolean from `health.ping()`.)

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
