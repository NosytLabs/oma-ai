import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, parseAbiItem, type Hex } from "viem";
import { USDC_BASE } from "../../constants.js";
import { paymentCreditAmounts, readTreasuryTransfer } from "../funding-recovery.js";

const payer = `0x${"11".repeat(20)}` as const;
const treasury = `0x${"22".repeat(20)}` as const;
const transfer = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const log = {
  address: USDC_BASE,
  topics: encodeEventTopics({ abi: [transfer], eventName: "Transfer", args: { from: payer, to: treasury } }) as Hex[],
  data: encodeAbiParameters([{ type: "uint256" }], [1234567n]),
};

describe("funding recovery from confirmed USDC logs", () => {
  it("recovers the token payer rather than the facilitator that sent the transaction", () => {
    expect(readTreasuryTransfer({ status: "success", logs: [log] }, treasury)).toEqual({ payFrom: payer, amount: "1.234567" });
  });
  it("rejects reverted, wrong-token, wrong-treasury and ambiguous receipts", () => {
    expect(readTreasuryTransfer({ status: "reverted", logs: [log] }, treasury)).toBeNull();
    expect(readTreasuryTransfer({ status: "success", logs: [{ ...log, address: payer }] }, treasury)).toBeNull();
    expect(readTreasuryTransfer({ status: "success", logs: [log] }, payer)).toBeNull();
    expect(readTreasuryTransfer({ status: "success", logs: [log, log] }, treasury)).toBeNull();
  });
});

describe("USDC funding credit precision", () => {
  it("credits every paid atomic unit, including sub-cent transfers", () => {
    expect(paymentCreditAmounts("0.000001")).toEqual({ amountUsd: "0.000001", credits: "0.0001", creditedCents: 0.0001 });
    expect(paymentCreditAmounts("1.234567")).toEqual({ amountUsd: "1.234567", credits: "123.4567", creditedCents: 123.4567 });
    expect(paymentCreditAmounts("1.00").creditedCents).toBe(100);
  });
});
