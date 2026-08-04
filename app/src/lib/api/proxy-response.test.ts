import { describe, expect, it } from "vitest";
import { proxyResponse } from "./proxy-response";

describe("proxyResponse", () => {
	it("preserves the streamed body, status, content headers, and multiple cookies", async () => {
		const upstream = new Response("ok", {
			status: 201,
			headers: {
				"content-type": "application/json",
				"cache-control": "no-store",
			},
		});
		Object.defineProperty(upstream.headers, "getSetCookie", {
			value: () => ["session=one; HttpOnly; Path=/", "csrf=two; Path=/"],
		});

		const response = proxyResponse(upstream);

		expect(response.status).toBe(201);
		expect(response.headers.get("content-type")).toBe("application/json");
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(response.headers.get("set-cookie")).toContain("session=one");
		expect(response.headers.get("set-cookie")).toContain("csrf=two");
		expect(await response.text()).toBe("ok");
	});

	it("does not forward hop-by-hop headers", () => {
		const upstream = new Response("ok", {
			headers: { connection: "keep-alive", "content-type": "text/plain" },
		});
		const response = proxyResponse(upstream);

		expect(response.headers.get("connection")).toBeNull();
		expect(response.headers.get("content-type")).toBe("text/plain");
	});
});
