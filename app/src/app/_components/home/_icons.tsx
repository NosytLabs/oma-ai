/**
	* Trust strip — plain-text wordmarks for upstream providers.
	*
	* Why no SVG marks?
	* Hand-rolled replicas of OpenAI / Anthropic / Base / USDC marks are
	* trademark-unsafe AND visually wrong in ways a trained eye spots
	* instantly. Plain wordmarks with a footnote are the honest,
	* lowest-risk representation of "we route to these providers".
	*
	* The trust-strip component renders these as text separated by dots,
	* so no rendering lives in this module.
	*/

export const TRUST_NAMES = [
	"Venice",
	"Zyloo",
	"Gonka",
	"OpenBroker",
	"LiteLLM",
] as const;