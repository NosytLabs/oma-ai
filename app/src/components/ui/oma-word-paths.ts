/**
 * Wordmark metrics for the geometric "oma" lockup.
 * Rendered as system-font SVG text (not hand-traced paths) so letterforms
 * stay optically correct at 14–24px beside the gateway mark.
 */

export const OMA_WORD_SM = {
	w: 40,
	h: 14,
	fontSize: 13.5,
	baseline: 11.2,
	letterSpacing: -0.4,
} as const;

export const OMA_WORD_MD = {
	w: 62,
	h: 22,
	fontSize: 21,
	baseline: 17.5,
	letterSpacing: -0.6,
} as const;
