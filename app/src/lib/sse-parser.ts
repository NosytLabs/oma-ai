/**
	* SSE events end with \n\n. A single event can have multiple
	* `data:` lines that must be concatenated. Per the SSE spec, ignore lines
	* starting with `:` (comment). A bare `data:` line is treated as the string
	* "data: ". The event ends at the first blank line.
	*/
export interface SSEBlock {
	event?: string;
	data: string[];
	id?: string;
}

export function parseSSEBlock(block: string): SSEBlock | null {
	if (!block || block.trim() === "") return null;
	const lines = block.split("\n");
	const data: string[] = [];
	let event: string | undefined;
	let id: string | undefined;
	for (const line of lines) {
		if (!line || line.startsWith(":")) continue;
		const colon = line.indexOf(":");
		const field = colon === -1 ? line : line.slice(0, colon);
		const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
		if (field === "data") data.push(value);
		else if (field === "event") event = value;
		else if (field === "id") id = value;
	}
	if (data.length === 0 && !event && !id) return null;
	return { event, data, id };
}
