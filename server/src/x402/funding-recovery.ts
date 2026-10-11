import { decodeEventLog, formatUnits, parseAbiItem, type Hex } from "viem";
import { USDC_BASE, USDC_DECIMALS } from "../constants.js";
import { parseUsdcAtomic } from "./facilitator-signing.js";

const transfer = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

/** A relayed EIP-3009 transaction's `from` is the facilitator, not the payer. */
export function readTreasuryTransfer(receipt: {
  status: string;
  logs: readonly { address: string; data: Hex; topics: readonly Hex[] }[];
}, treasury: string): { payFrom: string; amount: string } | null {
  if (receipt.status !== "success") return null;
  const payments: { payFrom: string; amount: string }[] = [];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== USDC_BASE.toLowerCase()) continue;
    try {
      const { args } = decodeEventLog({ abi: [transfer], eventName: "Transfer", data: log.data, topics: log.topics as [Hex, ...Hex[]] });
      if (args.to.toLowerCase() === treasury.toLowerCase() && args.value > 0n) {
        payments.push({ payFrom: args.from.toLowerCase(), amount: formatUnits(args.value, USDC_DECIMALS) });
      }
    } catch { /* Unrelated or malformed log, not payment evidence. */ }
  }
  // Do not guess ownership or credit amount for multi-transfer transactions.
  return payments.length === 1 ? payments[0]! : null;
}

export function paymentCreditAmounts(amount: string) {
  // Postgres numeric columns pad to eight decimals; USDC has six. Remove
  // only insignificant zeroes, never round away a fractional atomic unit.
  const decimal = /^(\d+)\.(\d+)$/.exec(amount);
  const fraction = decimal?.[2]?.replace(/0+$/, "");
  const canonical = decimal ? `${decimal[1]}${fraction ? `.${fraction}` : ""}` : amount;
  const atomic = parseUsdcAtomic(canonical);
  if (atomic <= 0n) throw new Error("x402 settlement amount must be positive");
  // The ledger supports fractional cents. Integer division discarded paid USDC.
  const credits = formatUnits(atomic, USDC_DECIMALS - 2);
  return { amountUsd: formatUnits(atomic, USDC_DECIMALS), credits, creditedCents: Number(credits) };
}
