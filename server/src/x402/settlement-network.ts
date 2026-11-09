/**
 * The settlement network vocabulary.
 *
 * OMA settles on exactly one chain today. The network id arrives from the
 * request as a free string (the x402 payload's `networkId`, which may be a
 * CAIP-2 form like "eip155:8453" or the internal short name), and it was
 * compared as a bare literal in four files. The vocabulary lives here so the
 * canonical internal value has one name and the CAIP-2 mapping has one home.
 */

/** The CAIP-2 id for Base mainnet. */
export const CAIP2_BASE_MAINNET = "eip155:8453";

/** Canonical internal network ids. */
export const SETTLEMENT_NETWORK = {
	Base: "base",
} as const;

type SettlementNetwork =
	(typeof SETTLEMENT_NETWORK)[keyof typeof SETTLEMENT_NETWORK];

/** Wire/CAIP-2 form -> canonical internal id. Unknown -> null. */
const CAIP2_TO_INTERNAL: Record<string, SettlementNetwork> = {
	[CAIP2_BASE_MAINNET]: SETTLEMENT_NETWORK.Base,
	[SETTLEMENT_NETWORK.Base]: SETTLEMENT_NETWORK.Base,
};

/**
 * Parse a request's network id into the canonical internal value.
 *
 * `null` for anything unknown: a caller declaring an unsupported network must
 * never be silently reinterpreted as Base -- the chain id drives signature
 * verification, so "close enough" is a wrong answer.
 */
export function parseSettlementNetwork(
	raw: string | undefined | null,
): SettlementNetwork | null {
	if (!raw) return null;
	return CAIP2_TO_INTERNAL[raw.toLowerCase()] ?? null;
}
