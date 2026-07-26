/**
 * Shared types for the auth component primitives.
 *
 * The wallet provider in `wallet-provider.tsx` is the source of truth for
 * the underlying wagmi connection state; these primitives only re-shape
 * it into UI affordances.
 */

export type ConnectorKind =
	| "metamask"
	| "injected"
	| "unknown";

export interface ConnectorView {
	id: string;
	name: string;
	kind: ConnectorKind;
	icon?: string;
}

export type AuthErrorKind =
	| "user_rejected"
	| "no_wallet"
	| "wrong_chain"
	| "signature_failed"
	| "rate_limited"
	| "network"
	| "unknown";

export interface AuthErrorShape {
	kind: AuthErrorKind;
	message: string;
	/** Seconds to wait before retrying (for rate-limit errors). */
	retryAfterSec?: number;
}
