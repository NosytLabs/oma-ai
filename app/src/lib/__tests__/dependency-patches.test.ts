import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const braces = createRequire(import.meta.url)("braces");

describe("braces stack exhaustion mitigation (GHSA-vfj7-8cjw-p6xm)", () => {
	it("preserves normal file patterns, ranges and nested expansion", () => {
		expect(braces.expand("src/{app,lib}/**/*.{ts,tsx}")).toEqual(["src/app/**/*.ts", "src/app/**/*.tsx", "src/lib/**/*.ts", "src/lib/**/*.tsx"]);
		expect(braces.expand("{1..3}")).toEqual(["1", "2", "3"]);
		expect(braces.expand("{a,{b,c}}")).toEqual(["a", "b", "c"]);
	});
	it.each(["{", "("])("rejects excessive %s nesting before recursive processing", open => {
		const close = open === "{" ? "}" : ")";
		const input = open.repeat(4000) + "a,b" + close.repeat(4000);
		for (const method of [braces.parse, braces.compile, braces.expand, braces.stringify]) expect(() => method(input)).toThrow(/maximum depth/);
	});
	it.each(["compile", "expand", "stringify"])("guards %s when supplied an AST directly", method => {
		const root = { type: "root", nodes: [] as unknown[] };
		let parent: { type: string; nodes: unknown[]; parent?: unknown } = root;
		for (let depth = 0; depth < 1000; depth++) {
			const child = { type: "paren", nodes: [] as unknown[], parent };
			parent.nodes.push(child);
			parent = child;
		}
		expect(() => braces[method](root)).toThrow(/maximum depth/);
	});
});
