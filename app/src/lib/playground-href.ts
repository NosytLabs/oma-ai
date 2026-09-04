/**
	* Build the right /chat deep-link for a catalog model.
	* OMA only ships text + multimodal LLMs, so every catalog entry routes
	* to the text chat surface.
	*/
export function playgroundHrefForModel(id: string): string {
	return `/chat?model=${encodeURIComponent(id)}`;
}
