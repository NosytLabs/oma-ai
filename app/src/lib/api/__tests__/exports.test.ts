import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../index";
afterEach(() => { vi.unstubAllGlobals(); });

describe("usage report downloads", () => {
	it("sends the selected range and retains truncation metadata without altering the CSV", async () => {
		const csv = "request_id,total_cents\r\nr1,0.00000600";
		const fetchMock = vi.fn().mockResolvedValue(new Response(csv, { headers: {
			"X-Export-Row-Count": "10000", "X-Export-Truncated": "true",
		} }));
		vi.stubGlobal("fetch", fetchMock);
		const report = await api.exportData.usageReport("csv", { since: "2026-10-04T00:00:00Z", until: "2026-10-11T00:00:00Z" });
		const url = new URL(fetchMock.mock.calls[0][0], "https://www.oma-ai.com");
		expect(url.searchParams.get("since")).toBe("2026-10-04T00:00:00Z");
		expect(url.searchParams.get("until")).toBe("2026-10-11T00:00:00Z");
		expect(report).toMatchObject({ rowCount: 10000, truncated: true });
		expect(await report.blob.text()).toBe(csv);
	});
});
