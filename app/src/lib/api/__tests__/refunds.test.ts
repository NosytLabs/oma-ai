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
	it.each([undefined, false, "true", true])("requires an explicit backend credit-refund capability: %j", async (capability) => {
		fetchMock.mockResolvedValueOnce(Response.json({ data: [], creditRefundsAvailable: capability }));
		expect(await refunds.list()).toMatchObject({ creditRefundsAvailable: capability === true });
	});
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
