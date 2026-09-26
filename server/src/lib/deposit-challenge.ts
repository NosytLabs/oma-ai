import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAddress, verifyMessage } from "viem";
import { config } from "../config.js";

/**
 * Stateless, HMAC-signed deposit challenge tokens.
 *
 * SECURITY (deposit Blocker): POST /v1/deposit/usdc previously accepted a
 * client-supplied `fromAddress` with no proof the caller controlled that
 * wallet. The on-chain watcher only checked that the mined Transfer's sender
 * equalled the self-reported fromAddress — and both the txHash and the sender
 * are public on-chain data — so any authenticated user could watch a victim's
 * broadcast USDC transfer, submit the same txHash + the victim's real
 * fromAddress under their OWN account, and have the credits attributed to
 * themselves.
 *
 * The fix is cryptographic ownership proof: the depositor must sign a message
 * that BINDS (fromAddress, depositAddress, nonce) and, when a tx has been
 * broadcast, its txHash and declared amount (see buildDepositSignMessage). The wallet
 * signature is only possible for someone holding that wallet's private key, so
 * the recovered signer must equal fromAddress. The nonce is minted by this
 * module and bound to the authenticated userId via an HMAC tag, so the signed
 * message cannot be replayed by another user or resurrected later (short
 * expiry).
 *
 * The token itself is stateless (HMAC over the payload) so it works on Neon
 * Functions / multi-instance deployments with no shared Redis or DB row. The
 * auth bound is the same `config.ENCRYPTION_KEY` used elsewhere for user-data
 * encryption, guaranteeing every environment has it set.
 */

const DERIVED_KEY = `oma-deposit-challenge::${config.ENCRYPTION_KEY}`;

// Challenge lifetime: 5 minutes. Long enough to confirm in the wallet popup,
// short enough that a leaked signed message can't be reused tomorrow.
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

interface ChallengePayload {
	/** Authenticated userId the challenge was issued for. */
	userId: string;
	/** Wallet address the challenge is bound to. */
	fromAddress: string;
	/** Server-minted random nonce (readable by the client for the sign message). */
	nonce: string;
	/** ms epoch */
	iat: number;
	/** ms epoch */
	exp: number;
}

function b64url(input: string): string {
	return Buffer.from(input, "utf8").toString("base64url");
}

function b64urlDecode(input: string): string {
	return Buffer.from(input, "base64url").toString("utf8");
}

function hmac(data: string): Buffer {
	return createHmac("sha256", DERIVED_KEY).update(data).digest();
}

/** Generate a random nonce from a CSPRNG (never Math.random). */
export function generateNonce(): string {
	return randomBytes(16).toString("hex");
}

/**
 * Issue a signed challenge token for the given user + sending wallet.
 * Returns the token (to send to the client) and the expiry.
 */
export function issueDepositChallenge(args: {
	userId: string;
	fromAddress: string;
}): { token: string; nonce: string; expiresAt: number } {
	const now = Date.now();
	const payload: ChallengePayload = {
		userId: args.userId,
		fromAddress: args.fromAddress.toLowerCase(),
		nonce: generateNonce(),
		iat: now,
		exp: now + CHALLENGE_TTL_MS,
	};
	const body = b64url(JSON.stringify(payload));
	const tag = hmac(body).toString("base64url");
	return { token: `${body}.${tag}`, nonce: payload.nonce, expiresAt: payload.exp };
}

const BAD = { ok: false as const, reason: "invalid" };

/**
 * Verify and decode a challenge token. Returns the payload only when the HMAC
 * tag is valid (binds the token to the server secret, so it can't be forged),
 * the token has not expired, the decoded structure is intact, and the token
 * was minted for the calling user & wallet.
 */
export function verifyDepositChallenge(args: {
	token: string;
	userId: string;
	fromAddress: string;
}): { ok: true; payload: ChallengePayload } | { ok: false; reason: string } {
	if (!args.token || typeof args.token !== "string") return BAD;
	const dot = args.token.lastIndexOf(".");
	if (dot <= 0) return BAD;
	const body = args.token.slice(0, dot);
	const providedTag = args.token.slice(dot + 1);

	let expectedTag: Buffer;
	try {
		expectedTag = hmac(body);
	} catch {
		return BAD;
	}
	let providedBuf: Buffer;
	try {
		providedBuf = Buffer.from(providedTag, "base64url");
	} catch {
		return BAD;
	}
	if (
		providedBuf.length !== expectedTag.length ||
		!timingSafeEqual(providedBuf, expectedTag)
	) {
		return { ok: false, reason: "invalid signature" };
	}

	let decoded: unknown;
	try {
		decoded = JSON.parse(b64urlDecode(body));
	} catch {
		return { ok: false, reason: "invalid payload" };
	}
	const p = decoded as Partial<ChallengePayload>;
	if (
		typeof p.userId !== "string" ||
		typeof p.fromAddress !== "string" ||
		typeof p.nonce !== "string" ||
		typeof p.iat !== "number" ||
		typeof p.exp !== "number"
	) {
		return { ok: false, reason: "invalid payload" };
	}

	const now = Date.now();
	if (now > p.exp) return { ok: false, reason: "expired" };
	if (p.userId !== args.userId) return { ok: false, reason: "user mismatch" };
	if (p.fromAddress !== args.fromAddress.toLowerCase()) {
		return { ok: false, reason: "wallet mismatch" };
	}

	return { ok: true, payload: p as ChallengePayload };
}

/** Canonical text the depositor's wallet signs to prove ownership. */
export function buildDepositSignMessage(args: {
	fromAddress: string;
	challengeToken: string;
	depositAddress: string;
	/** Optional on-chain tx hash this authorization is bound to. */
	txHash?: string;
	/** Optional declared USD amount this authorization is bound to. */
	amountUsd?: number | string;
}): string {
	const lines = [
		"OMA-AI deposit authorization",
		"",
		`Sending wallet: ${args.fromAddress}`,
		`Deposit to: ${args.depositAddress}`,
		`Challenge: ${args.challengeToken}`,
	];
	// SECURITY: binding the tx (and declared amount) into the signed message
	// prevents a captured signature from being replayed against a different
	// txHash or amount for the same wallet within the challenge TTL.
	if (args.txHash) lines.push(`Transaction: ${args.txHash}`);
	if (args.amountUsd !== undefined) lines.push(`Amount USD: ${args.amountUsd}`);
	return lines.join("\n");
}

/**
 * Verify a wallet `personal_sign`/EIP-191 signature over the canonical deposit
 * message recovers to `fromAddress`. This is the cryptographic ownership proof
 * that closes the deposit Blocker: only the holder of the sending wallet's
 * private key can produce a signature the server verifies against that address.
 */
export async function verifyDepositSignature(args: {
	fromAddress: string;
	depositAddress: string;
	challengeToken: string;
	signature: string;
	txHash?: string;
	amountUsd?: number | string;
}): Promise<boolean> {
	try {
		const message = buildDepositSignMessage({
			fromAddress: args.fromAddress,
			challengeToken: args.challengeToken,
			depositAddress: args.depositAddress,
			txHash: args.txHash,
			amountUsd: args.amountUsd,
		});
		const recovered = await verifyMessage({
			address: getAddress(args.fromAddress) as `0x${string}`,
			message,
			signature: args.signature as `0x${string}`,
		});
		return !!recovered;
	} catch {
		return false;
	}
}
