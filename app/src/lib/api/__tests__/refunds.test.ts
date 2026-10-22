import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refunds } from "../refunds";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fetchMock = vi.fn();
	vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("refunds.create", () => {
	it("POSTs to /v1/refunds with usageId + reason + content-type", async () => {
		fetchMock.mockResolvedValueOnce(
			Response.json({ id: "rfnd_1", status: "pending", createdAt: "2026-10-19T12:00:00Z" }),
		);
		const result = await refunds.create({
			usageId: "aaaa-bbbb-cccc",
			reason: "Model returned truncated reply despite max_tokens cap.",
		});
		expect(result.status).toBe("pending");
		const [url, init] = fetchMock.mock.calls[0]!;
		expect(url).toContain("/v1/refunds");
		expect(init.method).toBe("POST");
		expect(init.headers.get("content-type")).toBe("application/json");
		const body = JSON.parse(init.body as string);
		expect(body).toEqual({
			usageId: "aaaa-bbbb-cccc",
			reason: "Model returned truncated reply despite max_tokens cap.",
		});
		expect(body.amountCents).toBeUndefined();
	});

	it("includes amountCents only when caller supplied a partial amount", async () => {
		fetchMock.mockResolvedValueOnce(Response.json({ id: "rfnd_2", status: "pending" }));
		await refunds.create({
			usageId: "u1",
			reason: "Over-charged for partial completion.",
			amountCents: 25,
		});
		const [, init] = fetchMock.mock.calls[0]!;
		const body = JSON.parse(init.body as string);
		expect(body.amountCents).toBe(25);
	});

	it("surfaces a structured server error as an ApiError with parsed status + body message", async () => {
		fetchMock.mockResolvedValueOnce(
			Response.json(
				{ error: { message: "reason must be at least 10 characters" } },
				{ status: 400 },
			),
		);
		const { ApiError } = await import("../client");
		let captured: unknown;
		try {
			await refunds.create({ usageId: "u", reason: "too short" });
		} catch (e) {
			captured = e;
		}
		expect(captured).toBeInstanceOf(ApiError);
		// ApiError formats its message as `[<status>] <body message>`; the
		// raw body is still preserved on `.body` for callers that want
		// to surface a structured error.
		expect(captured).toMatchObject({ status: 400 });
		const capturedErr = captured as { body?: unknown };
		expect(JSON.stringify(capturedErr.body ?? {})).toContain("reason must be at least 10 characters");
	});

	it("falls back to statusText when the error body is not JSON", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response("not-json", { status: 504, statusText: "Gateway Timeout" }),
		);
		await expect(
			refunds.create({ usageId: "u", reason: "reason long enough" }),
		).rejects.toThrow(/504|Gateway Timeout/);
	});
});

describe("refunds.list", () => {
	it("shows refunds from the server's data envelope", async () => {
		fetchMock.mockResolvedValueOnce(Response.json({ data: [{
			id: "refund-1", status: "pending", reason: "Unusable response", amountCents: 0.00000234,
			createdAt: "2026-10-21T12:00:00Z",
		}] }));
		expect((await refunds.list()).items).toEqual([{
			id: "refund-1", status: "pending", reason: "Unusable response", amountCents: 0.00000234,
			createdAt: "2026-10-21T12:00:00Z",
		}]);
	});
	it("encodes status as a query param when supplied", async () => {
		fetchMock.mockResolvedValueOnce(
			Response.json({ items: [], nextCursor: null }),
		);
		await refunds.list("pending");
		const [url] = fetchMock.mock.calls[0]!;
		expect(url).toContain("/v1/refunds?limit=50&status=pending");
	});

	it("defaults to limit=50 with no status", async () => {
		fetchMock.mockResolvedValueOnce(
			Response.json({ items: [], nextCursor: null }),
		);
		await refunds.list();
		const [url] = fetchMock.mock.calls[0]!;
		expect(url).toContain("/v1/refunds?limit=50");
	});
});

describe("refunds.admin.list", () => {
	it("hits /v1/admin/refunds and accepts the { data: [...] } envelope", async () => {
		const envelope = {
			data: [
				{
					id: "rfnd_a",
					userId: "user_x",
					usageId: "use_1",
					amountCents: 50,
					status: "pending",
					reason: "Test reason text long enough.",
					adminNote: null,
					decidedBy: null,
					decidedAt: null,
					createdAt: "2026-10-19T12:00:00Z",
				},
			],
		};
		fetchMock.mockResolvedValueOnce(Response.json(envelope));
		const out = await refunds.admin.list("pending", 100);
		expect(out.data).toHaveLength(1);
		expect(out.data[0]?.amountCents).toBe(50);
		const [url] = fetchMock.mock.calls[0]!;
		expect(url).toContain("/v1/admin/refunds?limit=100&status=pending");
	});
});

describe("refunds.admin.decide", () => {
	it("POSTs { id, decision } without adminNote when not provided", async () => {
		fetchMock.mockResolvedValueOnce(
			Response.json({ ok: true, id: "rfnd_a", status: "granted" }),
		);
		const out = await refunds.admin.decide({ id: "rfnd_a", decision: "granted" });
		expect(out).toEqual({ ok: true, id: "rfnd_a", status: "granted" });
		const [url, init] = fetchMock.mock.calls[0]!;
		expect(url).toContain("/v1/admin/refunds");
		expect(init.method).toBe("POST");
		const body = JSON.parse(init.body as string);
		expect(body).toEqual({ id: "rfnd_a", decision: "granted" });
		expect(body.adminNote).toBeUndefined();
	});

	it("includes adminNote when caller supplied one", async () => {
		fetchMock.mockResolvedValueOnce(
			Response.json({ ok: true, id: "rfnd_b", status: "denied" }),
		);
		await refunds.admin.decide({
			id: "rfnd_b",
			decision: "denied",
			adminNote: "Out of scope per terms §4.2.",
		});
		const [, init] = fetchMock.mock.calls[0]!;
		const body = JSON.parse(init.body as string);
		expect(body.adminNote).toBe("Out of scope per terms §4.2.");
	});

	describe("refunds.admin.decide — adminNote serialization", () => {
	it("omits adminNote from the body when the field is undefined", async () => {
		fetchMock.mockResolvedValueOnce(
			Response.json({ ok: true, id: "rfnd_d", status: "denied" }),
		);
		await refunds.admin.decide({ id: "rfnd_d", decision: "denied" });
		const [, init] = fetchMock.mock.calls[0]!;
		const body = JSON.parse(init.body as string);
		// The wrapper uses (...input.adminNote !== undefined && { adminNote: ... })
		// so an undefined value is the only thing the spread will skip.
		expect("adminNote" in body).toBe(false);
	});

	it("sends empty-string adminNote through verbatim (callers should leave it off)", async () => {
		fetchMock.mockResolvedValueOnce(
			Response.json({ ok: true, id: "rfnd_e", status: "denied" }),
		);
		await refunds.admin.decide({
			id: "rfnd_e",
			decision: "denied",
			adminNote: "",
		});
		const [, init] = fetchMock.mock.calls[0]!;
		const body = JSON.parse(init.body as string);
		// Documenting actual behavior: only `undefined` is omitted.
		// Trimming would be a server-side concern (server already caps
		// at 1000 chars in decideRefundSchema).
		expect(body.adminNote).toBe("");
	});
});
});
