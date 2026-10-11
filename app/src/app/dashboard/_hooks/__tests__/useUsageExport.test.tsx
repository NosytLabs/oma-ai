import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUsageExport } from "../useUsageExport";

const mocks = vi.hoisted(() => ({ report: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { exportData: { usageReport: mocks.report } } }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => mocks }));
const options = { userId: "account-a", enabled: true, range: { since: "2026-10-04T00:00:00Z", until: "2026-10-11T00:00:00Z" }, rangeLabel: "7d" };
const report = { blob: new Blob(["request_id,total_cents\r\nr1,0.00000600"]), rowCount: 1, truncated: false };
beforeEach(() => {
	vi.clearAllMocks(); mocks.report.mockResolvedValue(report);
	vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
	vi.stubGlobal("URL", class extends URL {
		static createObjectURL = vi.fn(() => "blob:export");
		static revokeObjectURL = vi.fn();
	});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("account-scoped usage downloads", () => {
	it("exports the selected range and prevents duplicate clicks while pending", async () => {
		let finish!: (value: typeof report) => void;
		mocks.report.mockReturnValue(new Promise(resolve => { finish = resolve; }));
		const { result } = renderHook(() => useUsageExport(options));
		let first!: Promise<void>;
		act(() => { first = result.current.exportUsage(); void result.current.exportUsage(); });
		expect(result.current.exporting).toBe(true);
		expect(mocks.report).toHaveBeenCalledTimes(1);
		expect(mocks.report).toHaveBeenCalledWith("csv", expect.objectContaining(options.range));
		await act(async () => { finish(report); await first; });
		expect(result.current.exporting).toBe(false);
		expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
		expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:export");
		expect(mocks.success).toHaveBeenCalledWith("Exported 1 request for 7d");
	});
	it("never fetches account data from a demo or signed-out view", async () => {
		const { result } = renderHook(() => useUsageExport({ ...options, enabled: false }));
		await act(async () => { await result.current.exportUsage(); });
		expect(mocks.report).not.toHaveBeenCalled();
	});
	it("aborts on account changes and cannot download the previous account's response", async () => {
		let finish!: (value: typeof report) => void;
		mocks.report.mockReturnValue(new Promise(resolve => { finish = resolve; }));
		const { result, rerender } = renderHook(({ userId }) => useUsageExport({ ...options, userId }), { initialProps: { userId: "account-a" } });
		let pending!: Promise<void>;
		act(() => { pending = result.current.exportUsage(); });
		const signal = mocks.report.mock.calls[0][1].signal as AbortSignal;
		rerender({ userId: "account-b" });
		expect(signal.aborted).toBe(true);
		await act(async () => { finish(report); await pending; });
		expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
		expect(mocks.success).not.toHaveBeenCalled();
	});
	it("reports truncation honestly instead of claiming a complete export", async () => {
		mocks.report.mockResolvedValue({ ...report, rowCount: 10000, truncated: true });
		const { result } = renderHook(() => useUsageExport(options));
		await act(async () => { await result.current.exportUsage(); });
		expect(mocks.info).toHaveBeenCalledWith(expect.stringMatching(/10,000.*smaller date range/i));
		expect(mocks.success).not.toHaveBeenCalled();
	});
	it("does not download a response without verified export details and permits retry", async () => {
		mocks.report.mockResolvedValueOnce({ ...report, rowCount: null });
		const { result } = renderHook(() => useUsageExport(options));
		await act(async () => { await result.current.exportUsage(); });
		expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
		expect(mocks.error).toHaveBeenCalledWith("Export details unavailable. Refresh and try again.");
		expect(result.current.exporting).toBe(false);
		await act(async () => { await result.current.exportUsage(); });
		expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
	});
});
