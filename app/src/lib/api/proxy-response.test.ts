import { describe, expect, it } from "vitest";
import { proxyResponse } from "./proxy-response";

describe("proxyResponse", () => {
	it("removes Connection-nominated response extensions while retaining the SSE stream", async () => {
		const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("data: hello\n\n")); controller.close(); } });
		const upstream = new Response(body, { headers: {
			connection: "keep-alive, X-Internal-Hop", "x-internal-hop": "private-hop", "proxy-connection": "keep-alive",
			"content-type": "text/event-stream", "content-encoding": "gzip", "content-length": "100",
			"set-cookie": "session=one; HttpOnly; Path=/",
		} });
		const response = proxyResponse(upstream);
		expect(response.body).toBe(upstream.body);
		for (const name of ["connection", "x-internal-hop", "proxy-connection", "content-encoding", "content-length"]) expect(response.headers.has(name)).toBe(false);
		expect(response.headers.get("content-type")).toBe("text/event-stream");
		expect(response.headers.getSetCookie()).toEqual(["session=one; HttpOnly; Path=/"]);
		expect(await response.text()).toBe("data: hello\n\n");
	});

	it("does not restore cookies explicitly nominated as connection-only", () => {
		const upstream = new Response("ok", { headers: { connection: "Set-Cookie", "set-cookie": "hop-cookie=private" } });
		expect(proxyResponse(upstream).headers.has("set-cookie")).toBe(false);
	});

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
