import { describe, expect, it } from "vitest";
import { stripHopByHopHeaders } from "./hop-headers";

describe("stripHopByHopHeaders", () => {
	it("filters the plain header record used by the auth proxy", () => {
		const values: Record<string, string> = {
			connection: "keep-alive, X-Auth-Hop", "x-auth-hop": "private",
			"transfer-encoding": "chunked", cookie: "oma.session_token=retained", origin: "https://www.oma-ai.com",
		};
		stripHopByHopHeaders({ get: name => values[name] ?? null, delete: name => { delete values[name]; } });
		expect(values).toEqual({ cookie: "oma.session_token=retained", origin: "https://www.oma-ai.com" });
	});

	it("ignores malformed Connection options without failing header normalization", () => {
		const headers = new Headers({ connection: "x-valid, , bad;option, [bad]", "x-valid": "drop", authorization: "Bearer retained" });
		expect(() => stripHopByHopHeaders(headers)).not.toThrow();
		expect(headers.has("connection")).toBe(false);
		expect(headers.has("x-valid")).toBe(false);
		expect(headers.get("authorization")).toBe("Bearer retained");
	});
});
