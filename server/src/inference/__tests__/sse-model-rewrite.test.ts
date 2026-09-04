import { describe, expect, it } from "vitest";
import { rewriteSseModelField } from "../fallback.js";

describe("rewriteSseModelField", () => {
	it("rewrites model id in SSE data lines", () => {
		const chunk =
			'data: {"id":"1","model":"upstream-raw","choices":[{"delta":{"content":"hi"}}]}\n\n';
		const out = rewriteSseModelField(chunk, "deepseek-v4-flash-openbroker");
		expect(out).toContain('"model":"deepseek-v4-flash-openbroker"');
		expect(out).not.toContain("upstream-raw");
	});

	it("leaves [DONE] and non-data lines alone", () => {
		const chunk = "event: ping\ndata: [DONE]\n\n";
		expect(rewriteSseModelField(chunk, "gpt-4o")).toBe(chunk);
	});

	it("is a no-op when actualModelId is empty", () => {
		const chunk = 'data: {"model":"x"}\n';
		expect(rewriteSseModelField(chunk, "")).toBe(chunk);
	});
});
