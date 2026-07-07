import { describe, expect, it } from "vitest";
import { POST } from "./route";

function makeRequest(body: unknown): Request {
	return new Request("http://localhost/api/support", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /api/support", () => {
	it("rejects empty body with 400", async () => {
		const res = await POST(
			new Request("http://localhost/api/support", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "not-json",
			}),
		);
		expect(res.status).toBe(400);
	});

	it("rejects unknown topic with 400", async () => {
		const res = await POST(
			makeRequest({ topic: "Nope", email: "a@b.com", message: "hello world" }),
		);
		expect(res.status).toBe(400);
	});

	it("rejects invalid email with 400", async () => {
		const res = await POST(
			makeRequest({ topic: "General", email: "not-an-email", message: "hello world" }),
		);
		expect(res.status).toBe(400);
	});

	it("rejects too-short message with 400", async () => {
		const res = await POST(
			makeRequest({ topic: "General", email: "a@b.com", message: "hi" }),
		);
		expect(res.status).toBe(400);
	});

	it("rejects malformed wallet with 400", async () => {
		const res = await POST(
			makeRequest({
				topic: "General",
				email: "a@b.com",
				message: "hello world",
				wallet: "0xZZZZ",
			}),
		);
		expect(res.status).toBe(400);
	});

	it("returns 202 with ticket id on success", async () => {
		const res = await POST(
			makeRequest({
				topic: "Billing",
				email: "a@b.com",
				message: "I need a refund please",
			}),
		);
		expect(res.status).toBe(202);
		const body = (await res.json()) as { ok: boolean; ticket: string; inbox: string };
		expect(body.ok).toBe(true);
		expect(body.ticket).toMatch(/^sup_/);
		expect(body.inbox).toBe("billing@oma-ai.com");
	});
});
