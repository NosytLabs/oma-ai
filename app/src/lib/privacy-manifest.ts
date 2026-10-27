/** Operational disclosures shared by the privacy page and its JSON manifest.
 * Sources: server DB schema, routes/auth.ts, auth.ts and payment-credit.ts.
 * Retention describes implemented deletion behavior, not an invented purge job.
 */
export const PRIVACY_UPDATED = "2026-10-25";

export const PRIVACY_RETENTION = [
	["Account and sessions", "Until deletion", "Profile, linked wallets and sessions are removed with the account. Sessions can include IP addresses and user-agent information."],
	["API keys", "Until account deletion", "Revocation or expiry stops authentication. A revoked or expired key's hash and metadata can remain until the account is deleted. Browser chat can hold an installed raw key in an HttpOnly cookie for up to seven days."],
	["Usage history", "Until cleared or deleted", "Account usage records remain until you clear history or delete the account. Separate financial records are retained as described below."],
	["Spendable credits", "Until account deletion", "Credits do not expire while the account is active. Deletion removes its balance and account-linked deposit records."],
	["Financial records", "Retained for reconciliation", "Payment claims, settlement records, card orders and detached inference receipts can survive account deletion. Order records can contain account identifiers and provider-supplied customer details."],
	["Security and signup records", "Retained after deletion", "Audit records can retain IP addresses, user agents and resource identifiers. Historical signup-grant records retain a normalized email or wallet-derived identifier to prevent repeat grants."],
] as const;

export const PRIVACY_MANIFEST = {
	service: "OMA AI",
	version: "2.0.0",
	effective_at: PRIVACY_UPDATED,
	contact: { privacy_email: "support@nosytlabs.com", security_email: "support@nosytlabs.com" },
	data_stored: {
		account: {
			description: "Email or SIWE wallet identity, profile and account settings. Wallet-only sign-in can create a wallet-derived email identifier.",
			fields: ["user_id", "email", "wallet_address", "name", "role", "suspension status"],
			retention: PRIVACY_RETENTION[0][2],
		},
		sessions_and_audit: {
			description: "Authentication sessions and account/security audit events can include IP addresses, user-agent information, timestamps and resource identifiers.",
			retention: "Sessions are removed on account deletion. Audit records can survive with their user foreign key cleared; resource identifiers and request metadata can remain.",
		},
		api_keys: {
			description: "The server database stores SHA-256 hashes, prefixes, names, timestamps, model scope and optional IP allowlists. The raw key is returned once at creation; browser chat can also install it in an HttpOnly authentication cookie for up to seven days.",
			retention: PRIVACY_RETENTION[1][2],
		},
		credits: {
			description: "Spendable balance, refund debt, deposits, usage totals and pending inference holds, in decimal-string cents.",
			retention: PRIVACY_RETENTION[3][2],
		},
		usage_records: {
			description: "Request IDs, requested/served models, provider response IDs, tokens, charges, estimated costs, status and timing. Prompts and answers are excluded.",
			retention: PRIVACY_RETENTION[2][2],
		},
		financial_records: {
			description: "Durable payment claims, settlements, signed card-event records, per-order credit ledgers and detached inference accounting receipts. Card-event payloads can include provider-supplied customer/order information.",
			retention: PRIVACY_RETENTION[4][2],
		},
		signup_grants: {
			description: "When a signup-credit offer is enabled, the normalized email or wallet-derived identifier, grant type, amount and timestamp prevent repeated grants after account deletion.",
			retention: "Historical grant records survive account deletion. A disabled offer creates no new grant.",
		},
		inference_content: {
			description: "Chat Completions and Messages request/response content is forwarded to the selected provider without being persisted in the gateway's usage ledger.",
			retention: "Website chat saves conversations and drafts locally in the current browser. Clear browser data separately; account deletion does not remove every browser's local copies.",
		},
	},
	data_not_stored: [
		"Raw OMA API-key secrets in the server database; an installed browser authentication cookie is separate",
		"Wallet private keys",
		"Full card numbers entered directly on Polar-hosted checkout",
		"Prompts or completion content in the gateway usage ledger",
	],
	third_party_processors: {
		inference: ["Venice AI", "OpenBroker/Gonka upstream routes"],
		payments: ["Polar-hosted card checkout", "Base USDC contracts and configured RPC providers"],
		operations: ["Vercel frontend hosting", "Neon API and Postgres", "Upstash Redis", "Resend authentication/support email", "Google Analytics when configured"],
		analytics: "When configured, the Google tag loads after hydration. Measurements are initialized on the production apex/www hosts and run on every pageview with IP addresses anonymized; no advertising signals are collected.",
		provider_policy: "Providers process requests sent to them. Privacy and retention depend on the selected provider/model; OMA does not promise a uniform upstream zero-retention policy.",
	},
	retention_policies: {
		inference_idempotency: "Database-backed claims and financial receipts prevent duplicate paid execution; financial reconciliation records can survive account deletion.",
		rate_limits: "Short-lived counters vary by route and model; see /docs#rate-limits. Session and audit IP metadata are separate retained records.",
		payments: "Confirmed payment claims and card order ledgers are durable financial records, not expiring cache entries.",
	},
	user_rights: {
		export: "GET /api/v1/export/account returns the account data included by the export implementation.",
		clear_history: "DELETE /api/v1/history clears account usage and prior account-linked audit history.",
		delete: "DELETE /api/account removes account-linked records. Financial, security and signup-grant records described above can remain.",
		api_key_revoke: "DELETE /api/v1/keys/:id stops future authentication with that key.",
		privacy_contact: "Email support@nosytlabs.com for access, correction, processing or deletion questions about retained records.",
	},
};
