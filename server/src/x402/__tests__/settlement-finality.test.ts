import { describe, expect, it, vi } from "vitest";

const { waitForTransactionReceipt, encodeFunctionData } = vi.hoisted(() => ({
	waitForTransactionReceipt: vi.fn(),
	encodeFunctionData: vi.fn(() => "0xdeadbeef"),
}));

vi.mock("viem", async (importOriginal) => {
	const actual = await importOriginal<typeof import("viem")>();
	return {
		...actual,
		encodeFunctionData,
		publicActions: {},
		createWalletClient: vi.fn(() => ({
			writeContract: vi.fn(async () => "0x" + "11".repeat(32)),
		})),
	};
});

vi.mock("viem/accounts", () => ({
	privateKeyToAccount: vi.fn(() => ({ address: "0x" + "22".repeat(20) })),
}));

vi.mock("../../config.js", () => ({
	config: {
		FACILITATOR_PRIVATE_KEY: "0x" + "33".repeat(64),
		CHAIN_RPC_URL: "http://localhost:8545",
		NODE_ENV: "test",
	},
}));

vi.mock("../../lib/rpc-client.js", () => ({
	createBaseTransport: vi.fn(),
	getPublicClient: vi.fn(() => ({
		call: vi.fn(async () => "0x"),
		// The settlement path waits on THIS client's receipt, so the mock has
		// to expose it — otherwise every case "passes" by hitting a
		// not-a-function throw instead of the finality logic under test.
		waitForTransactionReceipt,
	})),
}));
vi.mock("../../lib/logger.js", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("./treasury.js", () => ({ SERVER_TREASURY: "0x" + "44".repeat(20) }));

import { submitEip3009TransferAndConfirm } from "../eip3009.js";

const auth = {
	from: "0x" + "55".repeat(20) as `0x${string}`,
	to: "0x" + "66".repeat(20) as `0x${string}`,
	value: "1000000",
	validAfter: "0",
	validBefore: "9999999999",
	nonce: "0x" + "77".repeat(32) as `0x${string}`,
};
const sig = "0x" + "88".repeat(65) as `0x${string}`;
const TX = "0x" + "11".repeat(32);

describe("settlement finality", () => {
	it("waits for the receipt and accepts a successful transaction", async () => {
		waitForTransactionReceipt.mockResolvedValueOnce({ status: "success", transactionHash: TX });
		await expect(submitEip3009TransferAndConfirm(auth, sig)).resolves.toBe(TX);
		expect(waitForTransactionReceipt).toHaveBeenCalledTimes(1);
	});

	it("rejects when the mined transaction reverted", async () => {
		// A broadcast transaction is not a payment. If the transfer reverts on
		// chain — insufficient balance at broadcast time, a race that consumed
		// the nonce, a paused contract — the server must not treat the payment
		// as settled and hand out credits.
		waitForTransactionReceipt.mockResolvedValueOnce({ status: "reverted", transactionHash: TX });
		await expect(submitEip3009TransferAndConfirm(auth, sig)).rejects.toThrow(/revert/i);
	});

	it("rejects when the receipt reports no status at all", async () => {
		waitForTransactionReceipt.mockResolvedValueOnce({ transactionHash: TX });
		await expect(submitEip3009TransferAndConfirm(auth, sig)).rejects.toThrow();
	});

	it("surfaces a receipt timeout rather than reporting success", async () => {
		waitForTransactionReceipt.mockRejectedValueOnce(new Error("Transaction receipt was not found"));
		await expect(submitEip3009TransferAndConfirm(auth, sig)).rejects.toThrow();
	});
});
