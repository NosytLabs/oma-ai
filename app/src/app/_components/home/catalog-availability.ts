import { isModelAvailable } from "@/lib/model-availability";

/** Marketing counts and examples refer to callable chat models. */
export function isAvailableChatModel(entry: {
	available?: boolean;
	modality?: string;
	category?: string;
}): boolean {
	if (!isModelAvailable(entry)) return false;
	const modality = (entry.modality ?? "").toLowerCase();
	if (modality) return modality === "chat";
	return ["budget", "mid", "premium", "frontier"].includes((entry.category ?? "").toLowerCase());
}
