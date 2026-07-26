/**
 * copyToClipboard — safe wrapper around navigator.clipboard.writeText.
 *
 * `navigator.clipboard` is async and can reject (permission denied,
 * insecure context, browser doesn't support it). Silent failure is a
 * footgun — callers should only show "Copied" state when this returns
 * true, and surface an error (or skip the success state) when it
 * returns false.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	if (typeof navigator === "undefined" || !navigator.clipboard) {
		return false;
	}
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (err) {
		console.error("Clipboard write failed:", err);
		return false;
	}
}
