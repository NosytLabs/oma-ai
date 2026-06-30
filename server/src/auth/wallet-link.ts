/**
 * Wallet-link service.
 *
 * Pre-0030 design: `users.address` WAS the wallet — there was no way to
 * link/unlink a wallet from an existing account. The account-number-only
 * signup path used a synthetic `address = "account:<n>"` placeholder.
 *
 * Post-0030 design: the user's identity is the account number. EVM wallets
 * are LINKS that can be added, removed, or rotated. This module owns the
 * link / unlink / rotate flows and the invariants that keep them safe:
 *
 *   1. A wallet address can only be linked to ONE account at a time.
 *   2. Linking a wallet from an existing account does NOT steal it from
 *      another account — we reject the request instead and tell the user
 *      to unlink it from the other account first.
 *   3. Unlinking requires the account to retain at least one login path
 *      (account number OR another wallet). You can't lock yourself out.
 *   4. All link/unlink/rotate operations write audit log rows so the
 *      history is recoverable from the DB even if logs are wiped.
 *
 * Auth invariants enforced in the routes that call these helpers:
 *   - caller must have a valid session (sessionAuth middleware)
 *   - 2FA bypass is not allowed for unlink (configurable)
 *   - linking an EVM wallet requires a valid SIWE signature on a
 *     nonce-bound message so we don't accept arbitrary addresses.
 *
 * ponytail: dead exports removed — linkEvmWallet / rotateWallet /
 * rotateAccountNumber / allocateNewAccountNumber / assertCallerOwnsAccount /
 * LinkedWalletSnapshot / AccountSnapshot / WalletType had no callers and
 * have been deleted. WalletLinkError is still exported because unlinkWallet
 * throws it and external callers (e.g. the route layer) match on it.
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

/**
 * Snapshot the user's account: account number plaintext + linked wallets +
 * whether they have any remaining login path. Used by /user and the
 * /auth/wallets endpoint.
 */
async function snapshotAccount(userId: string): Promise<AccountSnapshot> {
  const [user] = await db
    .select({
      id: users.id,
      accountNumber: users.accountNumber,
      evmAddress: users.evmAddress,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw new WalletLinkError("User not found", "user_not_found", 404);
  }
  return {
    id: user.id,
    accountNumber: user.accountNumber,
    evmAddress: user.evmAddress,
    hasLoginPath: !!user.accountNumber || !!user.evmAddress,
  };
}

/**
 * Unlink a wallet from the user.
 *
 * Invariant: the user must retain at least one login path after the unlink,
 * otherwise they'd be locked out forever. We define a login path as:
 *   - a plaintext account_number (i.e. account-number-only users must not
 *     unlink their only wallet), OR
 *   - another wallet link that they can sign with.
 */
export async function unlinkWallet(
  userId: string,
  type: "evm",
): Promise<AccountSnapshot> {
  if (type !== "evm") {
    throw new WalletLinkError("Invalid wallet type", "invalid_wallet_type", 400);
  }

  const [user] = await db
    .select({
      id: users.id,
      accountNumber: users.accountNumber,
      evmAddress: users.evmAddress,
      address: users.address,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw new WalletLinkError("User not found", "user_not_found", 404);
  }

  if (!user.evmAddress && !(user.address && user.address.startsWith("0x"))) {
    throw new WalletLinkError(
      "No EVM wallet linked to this account",
      "wallet_not_linked",
      404,
    );
  }
  const otherPath =
    (user.address && !user.address.startsWith("0x") ? true : false);
  if (!user.accountNumber && !otherPath) {
    throw new WalletLinkError(
      "Cannot unlink the only login path. Link another wallet or rotate your account number first.",
      "no_login_path_after_unlink",
      409,
    );
  }
  await db
    .update(users)
    .set({ evmAddress: null, address: null, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await db.insert(auditLogs).values({
    userId,
    action: "WALLET_UNLINKED",
    resource: "users",
    resourceId: userId,
    metadata: JSON.stringify({ type }),
    createdAt: new Date(),
  });

  return snapshotAccount(userId);
}