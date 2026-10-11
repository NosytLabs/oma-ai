/** RFC-style CSV escaping with spreadsheet formula protection for text cells. */
export function toCsv(rows: Record<string, unknown>[], columns = Object.keys(rows[0] ?? {})): string {
	const escape = (value: unknown) => {
		let text = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
		// Keep decimal amounts as numbers; nonnumeric formula-like text is literal.
		const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text);
		if (typeof value === "string" && !numeric && (/^\s*[=+\-@]/u.test(text) || /^[\t\r]/.test(text))) text = `'${text}`;
		return /[,"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
	};
	if (!columns.length) return "";
	return [columns.map(escape).join(","), ...rows.map(row => columns.map(key => escape(row[key])).join(","))].join("\r\n");
}
