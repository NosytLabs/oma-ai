import { describe, expect, it } from "vitest";
import {
	TX_RECEIPT_STATUS,
	isSuccessfulReceipt,
	parseTxReceiptStatus,
} from "../receipt-status.js";

describe("parseTxReceiptStatus", () => {
	it("knows the two chain statuses", () => {
		expect(parseTxReceiptStatus("success")).toBe(TX_RECEIPT_STATUS.Success);
		expect(parseTxReceiptStatus("reverted")).toBe(TX_RECEIPT_STATUS.Reverted);
	});

	it("returns null for anything else", () => {
		expect(parseTxReceiptStatus("SUCCESS")).toBeNull();
		expect(parseTxReceiptStatus("confirmed")).toBeNull();
		expect(parseTxReceiptStatus(undefined)).toBeNull();
		expect(parseTxReceiptStatus(null)).toBeNull();
	});
});

describe("isSuccessfulReceipt", () => {
	it("is true only for an explicit success", () => {
		expect(isSuccessfulReceipt({ status: "success" })).toBe(true);
		expect(isSuccessfulReceipt({ status: "reverted" })).toBe(false);
	});

	it("is false for a missing receipt or a missing status", () => {
		expect(isSuccessfulReceipt(null)).toBe(false);
		expect(isSuccessfulReceipt(undefined)).toBe(false);
		expect(isSuccessfulReceipt({})).toBe(false);
		expect(isSuccessfulReceipt({ status: undefined })).toBe(false);
	});

	it("never treats an unrecognised status as a success", () => {
		// An RPC shape this server does not know must not credit a payment.
		expect(isSuccessfulReceipt({ status: "ok" })).toBe(false);
		expect(isSuccessfulReceipt({ status: 1 })).toBe(false);
		expect(isSuccessfulReceipt({ status: true })).toBe(false);
	});
});
