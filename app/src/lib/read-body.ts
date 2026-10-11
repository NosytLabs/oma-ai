/** Bound streamed input before parsing or allocating an entire request. */
export class BodyTooLargeError extends Error {}

export async function readTextWithinLimit(message: Pick<Request, "body" | "headers">, maxBytes: number): Promise<string> {
	const length = message.headers.get("content-length");
	if (length && /^\d+$/.test(length) && Number(length) > maxBytes) {
		await message.body?.cancel();
		throw new BodyTooLargeError("Body size limit exceeded");
	}
	if (!message.body) return "";
	const reader = message.body.getReader();
	const decoder = new TextDecoder();
	let bytes = 0, text = "";
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) return text + decoder.decode();
			bytes += value.byteLength;
			if (bytes > maxBytes) {
				await reader.cancel();
				throw new BodyTooLargeError("Body size limit exceeded");
			}
			text += decoder.decode(value, { stream: true });
		}
	} finally { reader.releaseLock(); }
}
