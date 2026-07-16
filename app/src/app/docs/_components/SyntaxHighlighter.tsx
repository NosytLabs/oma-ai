"use client";

import { useMemo } from "react";

/**
 * Lightweight syntax highlighter for docs code blocks.
 * No external dependencies — tokenizes common languages with regex
 * and applies CSS class names for theming.
 */

type TokenType =
	| "keyword"
	| "string"
	| "number"
	| "comment"
	| "function"
	| "operator"
	| "punctuation"
	| "property"
	| "builtin"
	| "plain";

interface Token {
	type: TokenType;
	value: string;
}

const TOKEN_CLASSES: Record<TokenType, string> = {
	keyword: "sh-keyword",
	string: "sh-string",
	number: "sh-number",
	comment: "sh-comment",
	function: "sh-function",
	operator: "sh-operator",
	punctuation: "sh-punctuation",
	property: "sh-property",
	builtin: "sh-builtin",
	plain: "",
};

/* ── Language patterns ── */

const COMMON_KEYWORDS = new Set([
	"import",
	"from",
	"export",
	"default",
	"const",
	"let",
	"var",
	"function",
	"return",
	"if",
	"else",
	"for",
	"while",
	"try",
	"catch",
	"throw",
	"new",
	"await",
	"async",
	"class",
	"extends",
	"static",
	"this",
	"typeof",
	"in",
	"of",
	"break",
	"continue",
	"switch",
	"case",
	"yield",
	"void",
	"delete",
	"instanceof",
	"true",
	"false",
	"null",
	"undefined",
	// Python
	"def",
	"print",
	"with",
	"as",
	"pass",
	"raise",
	"except",
	"finally",
	"lambda",
	"nonlocal",
	"global",
	"assert",
	"del",
	"elif",
	"and",
	"or",
	"not",
	"is",
	"None",
	"True",
	"False",
	// Go
	"package",
	"func",
	"struct",
	"interface",
	"map",
	"chan",
	"go",
	"defer",
	"select",
	"range",
	"type",
	"import",
	"var",
	"const",
	"fallthrough",
	// Bash
	"curl",
	"echo",
	"if",
	"then",
	"fi",
	"do",
	"done",
	"for",
	"while",
	// JSON pseudo
	"true",
	"false",
	"null",
]);

const BUILTINS = new Set([
	"console",
	"Math",
	"Date",
	"JSON",
	"Promise",
	"Array",
	"Object",
	"String",
	"Number",
	"Boolean",
	"RegExp",
	"Error",
	"Map",
	"Set",
	"fetch",
	"setTimeout",
	"clearTimeout",
	"setInterval",
	"clearInterval",
	"process",
	"Buffer",
	"document",
	"window",
	"localStorage",
	"sessionStorage",
	"require",
	"module",
	"exports",
	"global",
	"__dirname",
	"__filename",
	// Python
	"len",
	"range",
	"enumerate",
	"zip",
	"map",
	"filter",
	"reduce",
	"open",
	"input",
	"int",
	"float",
	"str",
	"list",
	"dict",
	"tuple",
	"set",
	"bool",
	// Go
	"make",
	"append",
	"copy",
	"len",
	"cap",
	"panic",
	"recover",
	"close",
]);

function tokenize(code: string, lang: string): Token[] {
	const tokens: Token[] = [];
	let pos = 0;

	function push(type: TokenType, value: string) {
		if (value) tokens.push({ type, value });
	}

	function rest(): string {
		return code.slice(pos);
	}

	while (pos < code.length) {
		const remaining = rest();

		// Comments
		if (remaining.startsWith("//") || remaining.startsWith("#")) {
			const end = remaining.indexOf("\n");
			const comment = end === -1 ? remaining : remaining.slice(0, end);
			push("comment", comment);
			pos += comment.length;
			continue;
		}
		if (remaining.startsWith("/*")) {
			const end = remaining.indexOf("*/");
			const comment = end === -1 ? remaining : remaining.slice(0, end + 2);
			push("comment", comment);
			pos += comment.length;
			continue;
		}

		// Strings (single, double, backtick, triple quotes)
		if (remaining.startsWith('"""') || remaining.startsWith("'''")) {
			const quote = remaining.slice(0, 3);
			const end = remaining.indexOf(quote, 3);
			const str = end === -1 ? remaining : remaining.slice(0, end + 3);
			push("string", str);
			pos += str.length;
			continue;
		}
		if (
			remaining.startsWith('"') ||
			remaining.startsWith("'") ||
			remaining.startsWith("`")
		) {
			const quote = remaining[0];
			let end = 1;
			while (end < remaining.length) {
				if (remaining[end] === "\\") {
					end += 2;
					continue;
				}
				if (remaining[end] === quote) {
					end++;
					break;
				}
				end++;
			}
			push("string", remaining.slice(0, end));
			pos += end;
			continue;
		}

		// Numbers
		const numMatch = remaining.match(
			/^(0x[0-9a-fA-F]+|0o[0-7]+|0b[01]+|\d+\.?\d*(?:[eE][+-]?\d+)?)/,
		);
		if (numMatch) {
			push("number", numMatch[0]);
			pos += numMatch[0].length;
			continue;
		}

		// Identifiers / keywords
		const identMatch = remaining.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
		if (identMatch) {
			const word = identMatch[0];
			if (COMMON_KEYWORDS.has(word)) {
				push("keyword", word);
			} else if (BUILTINS.has(word)) {
				push("builtin", word);
			} else {
				// Check if next non-space char is ( => function call
				const after = remaining.slice(word.length);
				const nextNonSpace = after.match(/^\s*\(/) ? "function" : "plain";
				push(nextNonSpace, word);
			}
			pos += word.length;
			continue;
		}

		// Operators
		const opMatch = remaining.match(
			/^(===|!==|==|!=|=>|<=|>=|\+\+|--|&&|\|\||[-+*/%=<>!&|^~?:])/,
		);
		if (opMatch) {
			push("operator", opMatch[0]);
			pos += opMatch[0].length;
			continue;
		}

		// Punctuation
		const punctMatch = remaining.match(/^[{[\]}(),.;:]/);
		if (punctMatch) {
			push("punctuation", punctMatch[0]);
			pos += punctMatch[0].length;
			continue;
		}

		// JSON properties ("key":)
		if (lang === "json" && remaining.startsWith('"')) {
			const end = remaining.indexOf('"', 1);
			if (end !== -1) {
				const after = remaining.slice(end + 1);
				if (after.match(/^\s*:/)) {
					push("property", remaining.slice(0, end + 1));
					pos += end + 1;
					continue;
				}
			}
		}

		// Whitespace / any other char
		const wsMatch = remaining.match(/^\s+/);
		if (wsMatch) {
			push("plain", wsMatch[0]);
			pos += wsMatch[0].length;
			continue;
		}

		push("plain", remaining[0]);
		pos += 1;
	}

	return tokens;
}

/* ── Component ── */

export function SyntaxHighlighter({
	code,
	lang = "text",
}: {
	code: string;
	lang?: string;
}) {
	const tokens = useMemo(() => tokenize(code, lang), [code, lang]);

	return (
		<code className="block w-max min-w-full max-w-none font-mono text-[13px] leading-relaxed whitespace-pre">
			{tokens.map((t, i) =>
				t.type === "plain" ? (
					<span key={i}>{t.value}</span>
				) : (
					<span key={i} className={TOKEN_CLASSES[t.type]}>
						{t.value}
					</span>
				),
			)}
		</code>
	);
}
