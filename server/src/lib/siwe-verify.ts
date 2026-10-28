/**
 * Canonical SIWE (EIP-4361) signature verification.
 *
 * Single source of truth for "did this wallet really sign this message?" —
 * deliberately extracted from the inline `siwe({ verifyMessage })` closure in
 * auth.ts so POST /v1/user/attach-wallet verifies with the EXACT same
 * primitive the sign-in path uses. Two copies of this logic is how a wallet
 * gets accepted at sign-in but rejected when attaching, or worse, how a
 * weaker check sneaks into the attach path and becomes a takeover primitive.
 *
 * What this does NOT do: nonce, domain, or expiry validation. Those are
 * better-auth's job for the sign-in path (it issued the nonce and owns the
 * session). The attach endpoint consumes a separate, account-bound challenge
 * after signature verification; a login nonce cannot authorize attachment.
 */
import { verifyMessage, getAddress } from "viem";
import { logger } from "./logger.js";

/** EIP-55 checksummed 20-byte address. */
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
/** 65-byte r||s||v signature, hex encoded. */
const SIGNATURE_REGEX = /^0x[a-fA-F0-9]{130}$/;
/** Nonce/chainId in an EIP-4361 message are nonces or positive ints. */
const NUMERIC_FIELD = /^\d{1,78}$/;

/** The SIWE fields this codebase reads off a signed message. */
export interface ParsedSiweMessage {
	domain: string;
	address: string;
	chainId: number;
	/** Server-issued challenge; its purpose and owner are checked by the route. */
	nonce: string | null;
	/** ISO-8601 expiry, or null when the message carries no expiration. */
	expirationTime: string | null;
}

export class SiweVerificationError extends Error {
	constructor(
		message: string,
		readonly code:
			| "malformed_message"
			| "bad_address"
			| "bad_signature"
			| "expired"
			| "bad_chain"
			| "signature_mismatch",
	) {
		super(message);
		this.name = "SiweVerificationError";
	}
}

/**
 * Parse the EIP-4361 header line:
 *   <domain> wants you to sign in with your Ethereum account:
 *     <address>.\n\n<statement>
 *
 * Header-shape parsing only — no signature check, no semantic validation.
 * Returns the fields the attach endpoint needs to assert binding.
 */
export function parseSiweMessage(message: string): ParsedSiweMessage {
	if (typeof message !== "string" || message.length === 0) {
		throw new SiweVerificationError("Message is empty", "malformed_message");
	}
	// The first line is "<domain> wants you to sign in with your Ethereum account:"
	const header = message.split("\n", 1)[0] ?? "";
	const headerMatch =
		/^(?<domain>\S+) wants you to sign in with your Ethereum account:$/.exec(
			header.trim(),
		);
	if (!headerMatch?.groups?.domain) {
		throw new SiweVerificationError(
			"Not a Sign-In With Ethereum message",
			"malformed_message",
		);
	}

	// The address is the first whitespace-delimited token of the second line.
	// A wallet signer never emits leading whitespace there, and tolerating it
	// would let two byte-different messages verify as the same logical message.
	const lines = message.split("\n");
	const address = (lines[1] ?? "").trim().split(/\s+/)[0] ?? "";
	if (!ADDRESS_REGEX.test(address)) {
		throw new SiweVerificationError(
			"Message does not carry a valid address line",
			"malformed_message",
		);
	}

	let chainId: number | null = null;
	let expirationTime: string | null = null;
	let nonce: string | null = null;
	for (const line of lines.slice(2)) {
		if (line.startsWith("Chain ID: ")) {
			const raw = line.slice("Chain ID: ".length).trim();
			if (!NUMERIC_FIELD.test(raw)) {
				throw new SiweVerificationError("Malformed Chain ID", "bad_chain");
			}
			chainId = Number(raw);
		} else if (line.startsWith("Expiration Time: ")) {
			expirationTime = line.slice("Expiration Time: ".length).trim();
		} else if (line.startsWith("Nonce: ")) {
			nonce = line.slice("Nonce: ".length).trim();
		}
	}

	return {
		domain: headerMatch.groups.domain,
		address,
		// A message with no Chain ID line is not usable for binding: we record
		// wallet_address.chain_id and must not guess it from config.
		chainId: chainId ?? Number.NaN,
		expirationTime,
		nonce,
	};
}

/**
 * Reject a message that a relay could have authored for the user.
 *
 * SECURITY: the attach endpoint takes a client-supplied `message`. If the
 * message were free-form, a compromised/malicious client could hand us a
 * message whose `domain` is an attacker's site and whose address is the
 * ADMIN wallet — we would verify the signature against a message we never
 * bound to our own origin. Requiring the signed domain to equal the host the
 * server trusts means an attacker can only ever get a signature they watched
 * the user produce for *our* origin.
 */
export function assertSelfContainedMessage(
	parsed: ParsedSiweMessage,
	expectedDomain: string,
	expectedChainId: number,
): void {
	if (parsed.domain.toLowerCase() !== expectedDomain.toLowerCase()) {
		throw new SiweVerificationError(
			"Message domain does not match this site",
			"malformed_message",
		);
	}
	if (parsed.chainId !== expectedChainId) {
		throw new SiweVerificationError(
			`Message chain ID ${String(parsed.chainId)} does not match ${expectedChainId}`,
			"bad_chain",
		);
	}
	if (parsed.expirationTime) {
		const expiry = Date.parse(parsed.expirationTime);
		// An unparseable expiry is treated as "expired" rather than ignored:
		// silently skipping the check would let a malformed field bypass it.
		if (Number.isNaN(expiry) || expiry <= Date.now()) {
			throw new SiweVerificationError(
				"Message has expired",
				"expired",
			);
		}
	}
}

/**
 * Verify an EIP-191 personal-sign signature over `message` for `address`.
 *
 * Returns the EIP-55 checksummed address on success; throws
 * SiweVerificationError on every failure path so the caller never has to
 * distinguish "false" from "threw".
 */
export async function verifySiweSignature(args: {
	address: string;
	message: string;
	signature: string;
}): Promise<string> {
	const { address, message, signature } = args;
	if (!ADDRESS_REGEX.test(address)) {
		throw new SiweVerificationError("Address is not a 20-byte hex address", "bad_address");
	}
	if (!SIGNATURE_REGEX.test(signature)) {
		throw new SiweVerificationError(
			"Signature is not a 65-byte hex signature",
			"bad_signature",
		);
	}
	let checksummed: `0x${string}`;
	try {
		checksummed = getAddress(address);
	} catch {
		throw new SiweVerificationError("Address has a bad EIP-55 checksum", "bad_address");
	}

	// viem THROWS on a malformed signature / unrecoverable v rather than
	// returning false, so this must be an async try/catch — a `.then(onFulfilled,
	// onRejected)` chain would type the return as a bare Promise and hide the
	// intent. Never let that escape as a 500.
	let valid: boolean;
	try {
		valid = await verifyMessage({
			address: checksummed,
			message,
			signature: signature as `0x${string}`,
		});
	} catch (err) {
		logger.warn({ err, address }, "[siwe] signature recovery threw");
		throw new SiweVerificationError(
			"Signature could not be recovered",
			"signature_mismatch",
		);
	}
	if (!valid) {
		throw new SiweVerificationError(
			"Signature does not match the address",
			"signature_mismatch",
		);
	}
	return checksummed;
}
