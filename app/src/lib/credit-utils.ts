// Centralized credit pricing/math utility for OMA

/** Returns the number of credits for a given USD amount ($1 = 100 credits, 1 credit = 1 cent) */
export function usdToCredits(usd: number): number {
  return Math.floor(usd * 100);
}

/** Returns USD equivalent for a given credits amount */
function creditsToUsd(credits: number): number {
  return credits / 100;
}

/** Standard credit plans */
export const CREDIT_PLANS = [
  { credits: 1000, usd: 10, tag: "Hobby" },
  { credits: 5000, usd: 50, tag: "Builder" },
  { credits: 25000, usd: 250, tag: "Scale" },
];

/** Returns per-credit price as formatted string */
export function perCreditPrice(): string {
  return "$0.01 / credit";
}
