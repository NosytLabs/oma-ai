/**
 * Some reasoning models (DeepSeek V4 / R1-style) emit an inline
 * thinking block inside `content` instead of a separate
 * `reasoning_content` field. Split that so the UI can show a
 * collapsible Reasoning block and a clean answer.
 *
 * Tag names are built at runtime so this file stays easy to edit
 * in XML-sensitive tooling.
 */
const OPEN = "<" + "think>";
const CLOSE = "</" + "think>";

export function splitInlineThink(content: string): {
	content: string;
	reasoning: string;
} {
	const lower = content.toLowerCase();
	const start = lower.indexOf(OPEN);
	if (start === -1) return { content, reasoning: "" };
	const end = lower.indexOf(CLOSE, start + OPEN.length);
	if (end === -1) return { content, reasoning: "" };
	const reasoning = content.slice(start + OPEN.length, end).trim();
	const next = (content.slice(0, start) + content.slice(end + CLOSE.length)).trim();
	return { content: next, reasoning };
}
