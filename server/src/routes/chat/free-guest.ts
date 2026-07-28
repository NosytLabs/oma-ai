/**
 * Free website-chat guest path for OMA-AI (Gonka/OpenBroker) models.
 *
 * Pure helpers so auth decisions are unit-testable without Hono/I/O flakiness.
 * Server middleware uses {@link isFreeGuestModel} after loading the catalog entry.
 */

export const FREE_GUEST_USER_ID = "oma-ai-guest";

/** Catalog providers that ship free website chat without API key / wallet. */
export function isFreeGuestProvider(
  provider: string | null | undefined,
): boolean {
  return provider === "gonka";
}

/**
 * Whether a chat-completions request may proceed as an unauthenticated guest.
 * Requires a known free provider (today: gonka / OMA-AI OpenBroker models).
 */
export function isFreeGuestModel(modelInfo: {
  provider?: string | null;
} | null): boolean {
  if (!modelInfo) return false;
  return isFreeGuestProvider(modelInfo.provider);
}

/** Synthetic guest ids that must never hit real credit balance tables. */
export function isSyntheticGuestUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return (
    userId === FREE_GUEST_USER_ID ||
    userId === "x402-guest" ||
    userId.startsWith("oma-ai-guest")
  );
}
