/**
 * Tests for the shared SIWE verification primitives.
 *
 * These are the security boundary for POST /v1/user/attach-wallet: they pin
 * that a client-supplied message must be bound to OUR domain and OUR chain
 * before its signature means anything. The phishing replay test is the one
 * that matters — it fails against any implementation that only checks the
 * signature.
 */
import { describe, it, expect } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import {
	SiweVerificationError,
	assertSelfContainedMessage,
	parseSiweMessage,
	verifySiweSignature,
} from "../siwe-verify.js";

// Deterministic throwaway key — test-only, never funded, never configured.
const account = privateKeyToAccount(
	"0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);
const OTHER = "0x19C4c364d1CbB59a876aaD9F8953184a3F1302D4";
const DOMAIN = "www.oma-ai.com";
const CHAIN_ID = 8453;

function buildMessage(opts: {
	domain?: string;
	address?: string;
	chainId?: number | null;
	expirationTime?: string | null;
	statement?: string;
}): string {
	const domain = opts.domain ?? DOMAIN;
	const address = opts.address ?? account.address;
	const lines = [
		`${domain} wants you to sign in with your Ethereum account:`,
		address,
		"",
		opts.statement ?? "Sign in to OMA-AI.",
	];
	if (opts.chainId !== null) {
		lines.push("", `Chain ID: ${opts.chainId ?? CHAIN_ID}`);
	}
	if (opts.expirationTime) {
		lines.push(`Expiration Time: ${opts.expirationTime}`);
	}
	return lines.join("\n");
}

async function sign(message: string) {
	return account.signMessage({ message });
}

describe("parseSiweMessage", () => {
	it("extracts domain, address, chain and expiry", () => {
		const expiry = new Date(Date.now() + 60_000).toISOString();
		const parsed = parseSiweMessage(
			buildMessage({ expirationTime: expiry }),
		);
		expect(parsed.domain).toBe(DOMAIN);
		expect(parsed.address.toLowerCase()).toBe(account.address.toLowerCase());
		expect(parsed.chainId).toBe(CHAIN_ID);
		expect(parsed.expirationTime).toBe(expiry);
	});

	it("returns NaN chainId (not a guess) when Chain ID is absent", () => {
		const parsed = parseSiweMessage(buildMessage({ chainId: null }));
		expect(Number.isNaN(parsed.chainId)).toBe(true);
	});

	it("rejects a non-SIWE message", () => {
		expect(() => parseSiweMessage("hello world")).toThrow(
			SiweVerificationError,
		);
	});

	it("rejects an empty message", () => {
		expect(() => parseSiweMessage("")).toThrow(SiweVerificationError);
	});
});

describe("assertSelfContainedMessage", () => {
	it("accepts a message bound to our domain and chain", () => {
		expect(() =>
			assertSelfContainedMessage(
				parseSiweMessage(buildMessage({})),
				DOMAIN,
				CHAIN_ID,
			),
		).not.toThrow();
	});

	// THE regression test. Without domain binding, an attacker-owned site can
	// serve its own SIWE message, collect the admin's signature, and POST it
	// here to bind the admin wallet to an attacker account.
	it("REJECTS a validly-signed message for an attacker domain", async () => {
		const evil = buildMessage({ domain: "evil.example" });
		// The signature is genuinely valid — that is the whole point.
		const signature = await sign(evil);
		expect(signature).toMatch(/^0x[0-9a-f]{130}$/i);
		expect(() =>
			assertSelfContainedMessage(
				parseSiweMessage(evil),
				DOMAIN,
				CHAIN_ID,
			),
		).toThrow(/domain/i);
	});

	it("rejects a mismatched chain id", () => {
		expect(() =>
			assertSelfContainedMessage(
				parseSiweMessage(buildMessage({ chainId: 1 })),
				DOMAIN,
				CHAIN_ID,
			),
		).toThrow(/chain/i);
	});

	it("rejects a missing chain id rather than defaulting it", () => {
		expect(() =>
			assertSelfContainedMessage(
				parseSiweMessage(buildMessage({ chainId: null })),
				DOMAIN,
				CHAIN_ID,
			),
		).toThrow(SiweVerificationError);
	});

	it("rejects an expired message", () => {
		const expired = new Date(Date.now() - 60_000).toISOString();
		expect(() =>
			assertSelfContainedMessage(
				parseSiweMessage(buildMessage({ expirationTime: expired })),
				DOMAIN,
				CHAIN_ID,
			),
		).toThrow(/expired/i);
	});

	it("rejects an unparseable expiry instead of skipping the check", () => {
		expect(() =>
			assertSelfContainedMessage(
				parseSiweMessage(
					buildMessage({ expirationTime: "not-a-date" }),
				),
				DOMAIN,
				CHAIN_ID,
			),
		).toThrow(SiweVerificationError);
	});

	it("accepts a message with no expiry (the client's choice)", () => {
		expect(() =>
			assertSelfContainedMessage(
				parseSiweMessage(buildMessage({})),
				DOMAIN,
				CHAIN_ID,
			),
		).not.toThrow();
	});
});

describe("verifySiweSignature", () => {
	it("returns the checksummed address for a genuine signature", async () => {
		const message = buildMessage({});
		const signature = await sign(message);
		const got = await verifySiweSignature({
			address: account.address.toLowerCase(),
			message,
			signature,
		});
		expect(got).toBe(account.address);
	});

	it("rejects a signature made over a DIFFERENT message", async () => {
		const signature = await sign(buildMessage({ statement: "Other site." }));
		await expect(
			verifySiweSignature({
				address: account.address,
				message: buildMessage({}),
				signature,
			}),
		).rejects.toThrow(SiweVerificationError);
	});

	it("rejects another wallet's valid signature", async () => {
		const message = buildMessage({});
		const signature = await sign(message);
		await expect(
			verifySiweSignature({
				address: OTHER, // pretend the admin's wallet signed it
				message,
				signature,
			}),
		).rejects.toThrow(SiweVerificationError);
	});

	it("rejects a malformed signature without throwing a 500-class error", async () => {
		await expect(
			verifySiweSignature({
				address: account.address,
				message: buildMessage({}),
				signature: "0xdeadbeef",
			}),
		).rejects.toThrow(SiweVerificationError);
	});

	it("rejects a non-address", async () => {
		await expect(
			verifySiweSignature({
				address: "not-an-address",
				message: buildMessage({}),
				signature: `0x${"11".repeat(65)}`,
			}),
		).rejects.toThrow(SiweVerificationError);
	});
});