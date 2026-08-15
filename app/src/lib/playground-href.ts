/**
	* Build the right /chat deep-link for a catalog model.
	* OMA only ships text + multimodal LLMs, so every catalog entry routes
	* to the text chat surface.
	*/
export function playgroundHrefForModel(opts: {
	id: string;
	modality?: string | null;
	outputModalities?: string[] | null;
}): string {
	const id = encodeURIComponent(opts.id);
	return `/chat?model=${id}`;
}
