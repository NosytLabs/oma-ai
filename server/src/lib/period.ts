/**
 * Shared period parsing for analytics and usage routes.
 * Converts a period string (e.g. "7d", "30d", "90d") into a Date filter.
 */

const PERIOD_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const DEFAULT_DAYS = 30;

/**
 * Parse a period string and return a Date object representing the start of the period.
 * Accepts "7d", "30d", "90d". Defaults to 30d for unrecognized values.
 */
export function parsePeriodDate(period: string): Date {
  const days = PERIOD_DAYS[period] ?? DEFAULT_DAYS;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Parse a days parameter and return a Date object.
 * Clamps to [1, 365]. Defaults to 30.
 */
export function parseDaysDate(daysStr: string | undefined, defaultValue = 30): Date {
  const days = Math.min(Math.max(parseInt(daysStr ?? String(defaultValue), 10) || defaultValue, 1), 365);
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
