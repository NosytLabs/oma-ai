/**
 * Polar webhook processing state.
 *
 * `polar_webhook_events.processed` is an integer flag, and the code wrote and
 * compared the bare numbers `0` and `1`. The numbers meant two different
 * things in two different places: "claimed but not yet handled" and "handled",
 * and a reader had to know which was which from the surrounding SQL.
 *
 * The column stays an integer (changing it would need a migration on a table
 * that already holds financial records), but the two values are named here so
 * the write path and the read path agree on what they mean.
 */

/** The two values `polar_webhook_events.processed` can hold. */
export const POLAR_EVENT_PROCESSING = {
	/** The event was claimed but has not been applied yet. */
	Pending: 0,
	/** The event was applied (credited, reversed, or otherwise handled). */
	Processed: 1,
} as const;

export type PolarEventProcessing =
	(typeof POLAR_EVENT_PROCESSING)[keyof typeof POLAR_EVENT_PROCESSING];

/** True when the event has already been applied. */
export function isPolarEventProcessed(processed: number | null | undefined): boolean {
	return processed === POLAR_EVENT_PROCESSING.Processed;
}
