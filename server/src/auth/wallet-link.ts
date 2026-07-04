/**
 * Wallet-link service.
 *
 * Pre-0030: `users.address` was the wallet (no link/unlink). Account-number-only used synthetic `address = "account:<n>"`.
 * Post-0030: identity is the account number; EVM wallets are LINKS (add/remove/rotate).
 * Invariants: 1) one wallet per account, 2) no stealing from other accounts, 3) must retain login path, 4) audit logs.
 * Auth: sessionAuth required, 2FA for unlink, SIWE signature for linking.
 *
 * Dead exports removed: linkEvmWallet, rotateWallet, rotateAccountNumber, allocateNewAccountNumber,
 * assertCallerOwnsAccount, LinkedWalletSnapshot, AccountSnapshot, WalletType.
 * WalletLinkError remains (thrown by unlinkWallet, caught by routes).
 */
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, auditLogs } from "../db/schema.js";
import type { ContentfulStatusCode } from "hono/utils/http-status";

class WalletLinkError extends Error {
	constructor(
		message: string,
		public readonly code:
			| "wallet_already_linked"
			| "wallet_not_linked"
			| "wallet_verification_failed"
			| "no_login_path_after_unlink"
			| "user_not_found"
			| "invalid_wallet_type"
			| "invalid_address"
			| "account_number_required"
			| "internal_error",
		public readonly httpStatus: ContentfulStatusCode = 400,
	) {
		super(message);
		this.name = "WalletLinkError";
	}
}

interface AccountSnapshot {
	id: string;
	accountNumber: string | null;
	evmAddress: string | null;
	hasLoginPath: boolean;
}

/** Snapshot account: number + linked wallets + login path status. */
async function snapshotAccount(userId: string): Promise<AccountSnapshot> {
	const [user] = await db
		.select({ id: users.id, accountNumber: users.accountNumber, evmAddress: users.evmAddress })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	if (!user) throw new WalletLinkError("User not found", "user_not_found", 404);
	return { id: user.id, accountNumber: user.accountNumber, evmAddress: user.evmAddress, hasLoginPath: !!user.accountNumber || !!user.evmAddress };
}

/** Unlink wallet; user must retain at least one login path (account number or other wallet). */
export async function unlinkWallet(userId: string, type: "evm"): Promise<AccountSnapshot> {
	if (type !== "evm") throw new WalletLinkError("Invalid wallet type", "invalid_wallet_type", 400);

	const [user] = await db
		.select({ id: users.id, accountNumber: users.accountNumber, evmAddress: users.evmAddress, address: users.address })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	if (!user) throw new WalletLinkError("User not found", "user_not_found", 404);

	if (!user.evmAddress && !(user.address && user.address.startsWith("0x"))) {
		throw new WalletLinkError("No EVM wallet linked to this account", "wallet_not_linked", 404);
	}
	const otherPath = user.address && !user.address.startsWith("0x");
	if (!user.accountNumber && !otherPath) {
		throw new WalletLinkError("Cannot unlink the only login path. Link another wallet or rotate your account number first.", "no_login_path_after_unlink", 409);
	}

	await db.update(users).set({ evmAddress: null, address: null, updatedAt: new Date() }).where(eq(users.id, userId));

	await db.insert(auditLogs).values({ userId, action: "WALLET_UNLINKED", resource: "users", resourceId: userId, metadata: JSON.stringify({ type }), createdAt: new Date() });

	return snapshotAccount(userId);
}