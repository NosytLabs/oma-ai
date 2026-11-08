/**
 * Deposit status labels.
 *
 * The vocabulary now lives in `app/src/lib/api/deposit-status.ts`, next to
 * the rest of the deposit lifecycle, so the label table and the status
 * constants cannot drift apart. This module keeps the original import path
 * working for existing callers.
 */
export {
	depositStatusLabel,
	depositStatusTone,
	type DepositStatus,
	type DepositStatusTone,
} from "./api/deposit-status.js";
