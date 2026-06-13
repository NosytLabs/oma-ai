import { config } from "../config.js";

/**
 * Markup multiplier for billing.
 *
 * Returns `1 + OMA_MARKUP_PCT/100` (e.g. 1.25 for the default 25%
 * markup). Centralized here so all billing code reads from the same
 * source of truth and tests can stub the export.
 */
export function getMarkupMultiplier(): number {
  return 1 + config.OMA_MARKUP_PCT / 100;
}

export function getMarkupPercent(): number {
  return config.OMA_MARKUP_PCT;
}
