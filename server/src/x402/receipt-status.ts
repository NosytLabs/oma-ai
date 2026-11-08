/**
 * On-chain transaction receipt status.
 *
 * A receipt's `status` is produced by the chain and relayed by an RPC node.
 * Four call sites decided "did this payment actually succeed?" by comparing
 * the raw literal "success" against it -- payment crediting, x402
 * verification, funding recovery and EIP-3009 settlement. The comparison was
 * the same decision written four times, against a value that comes from
 * outside the process: an RPC node that reports a different shape would have
 * failed open on a different comparison in each place.
 *
 * The vocabulary lives here, and the decision lives with it: only an explicit
 * "success" counts as success. A missing, empty or unexpected status is not
 * success.
 */

export const TX_RECEIPT_STATUS = {
	/** The transaction executed successfully. */
	Success: "success",
	/** The transaction was mined but reverted. */
	Reverted: "reverted",
} as const;

export type TxReceiptStatus =
	(typeof TX_RECEIPT_STATUS)[keyof typeof TX_RECEIPT_STATUS];

/**
 * Parse a receipt status.
 *
 * Returns `null` for anything the vocabulary does not contain -- an RPC
 * shape this server does not know is "unknown", never "success".
 */
export function parseTxReceiptStatus(raw: unknown): TxReceiptStatus | null {
	if (raw === TX_RECEIPT_STATUS.Success) return TX_RECEIPT_STATUS.Success;
	if (raw === TX_RECEIPT_STATUS.Reverted) return TX_RECEIPT_STATUS.Reverted;
	return null;
}

/**
 * True only when the receipt reports a successful transaction.
 *
 * A missing receipt, a missing status or an unrecognised status are all
 * "not successful" -- the caller must not credit a payment it cannot confirm.
 */
export function isSuccessfulReceipt(
	receipt: { status?: unknown } | null | undefined,
): boolean {
	return parseTxReceiptStatus(receipt?.status) === TX_RECEIPT_STATUS.Success;
}
