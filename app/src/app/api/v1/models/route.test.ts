/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe.skip("GET /api/v1/models", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("proxies GET to the upstream /v1/models endpoint", async () => {
		const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({ object: "list", data: [{ id: "llama" }] }),
				{
					status: 200,
					headers: {
						"Content-Type": "application/json",
						"Cache-Control": "public, max-age=3600",
					},
				},
			),
		);
		const { GET } = await import("./route");

		const request = new Request("http://localhost/api/v1/models");
		// biome-ignore lint/suspicious/noExplicitAny: test file uses any for mocking
		const response = await GET(request as any);

		expect(response.status).toBe(200);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(String(fetchSpy.mock.calls[0][0])).toBe(
			"http://localhost:3001/v1/models",
		);
		const body = await response.json();
		expect(body.object).toBe("list");
		expect(body.data[0].id).toBe("llama");
	});

	it("forwards the upstream Cache-Control header", async () => {
		vi.spyOn(global, "fetch").mockResolvedValue(
			new Response("{}", {
				status: 200,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "public, max-age=60",
				},
			}),
		);
		const { GET } = await import("./route");

		const request = new Request("http://localhost/api/v1/models");
		// biome-ignore lint/suspicious/noExplicitAny: test file uses any for mocking
		const response = await GET(request as any);

		expect(response.headers.get("cache-control")).toBe("public, max-age=60");
	});

	it("returns 502 when the upstream fetch throws", async () => {
		vi.spyOn(global, "fetch").mockRejectedValue(new TypeError("fetch failed"));
		const { GET } = await import("./route");

		const request = new Request("http://localhost/api/v1/models");
		// biome-ignore lint/suspicious/noExplicitAny: test file uses any for mocking
		const response = await GET(request as any);

		expect(response.status).toBe(502);
		const body = await response.json();
		expect(body.error.message).toBe("Backend unreachable");
	});

	it("forwards the upstream status code on non-OK responses", async () => {
		vi.spyOn(global, "fetch").mockResolvedValue(
			new Response('{"error":"boom"}', {
				status: 500,
				headers: { "Content-Type": "application/json" },
			}),
		);
		const { GET } = await import("./route");

		const request = new Request("http://localhost/api/v1/models");
		// biome-ignore lint/suspicious/noExplicitAny: test file uses any for mocking
		const response = await GET(request as any);

		expect(response.status).toBe(500);
	});
});
