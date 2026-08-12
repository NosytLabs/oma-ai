/**
 * Build the right /chat deep-link for a catalog model.
 * Image/video models open Create studio; chat models open text chat.
 */
export function playgroundHrefForModel(opts: {
	id: string;
	modality?: string | null;
	outputModalities?: string[] | null;
}): string {
	const id = encodeURIComponent(opts.id);
	const modality = (opts.modality ?? "").toLowerCase();
	const outs = (opts.outputModalities ?? []).map((m) => m.toLowerCase());

	if (modality === "video" || outs.includes("video")) {
		return `/chat?mode=video`;
	}
	if (modality === "image" || outs.includes("image")) {
		return `/chat?mode=image`;
	}
	return `/chat?model=${id}`;
}
