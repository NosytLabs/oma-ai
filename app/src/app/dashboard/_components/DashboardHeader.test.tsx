import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardHeader } from "./DashboardHeader";

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-10-15T15:00:00Z"));
	vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

const base = { loading: false, modelsAvailable: 0, hasAnyData: true, notificationsEnabled: false };
async function advance(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

describe("dashboard refresh status", () => {
	it("labels sample data without pretending it synced or polling the account", async () => {
		const refresh = vi.fn();
		render(<DashboardHeader {...base} isDemo onRefresh={refresh} />);
		expect(screen.getByText("SAMPLE DATA")).toBeVisible();
		expect(screen.queryByText(/UPDATED|NEXT IN|AWAITING DATA/)).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Refresh dashboard" })).not.toBeInTheDocument();
		await advance(240_000);
		expect(refresh).not.toHaveBeenCalled();
	});

	it("does not offer a refresh or countdown without a data source", () => {
		render(<DashboardHeader {...base} />);
		expect(screen.queryByRole("button", { name: "Refresh dashboard" })).not.toBeInTheDocument();
		expect(screen.queryByText(/NEXT IN/)).not.toBeInTheDocument();
	});

	it("waits a full interval after a manual refresh before polling again", async () => {
		const refresh = vi.fn().mockResolvedValue(undefined);
		render(<DashboardHeader {...base} onRefresh={refresh} />);
		await advance(119_000);
		await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Refresh dashboard" })); });
		expect(refresh).toHaveBeenCalledTimes(1);
		await advance(1_000);
		expect(refresh).toHaveBeenCalledTimes(1);
		await advance(119_000);
		expect(refresh).toHaveBeenCalledTimes(2);
	});

	it("keeps a pending refresh locked while changing dashboard tabs", async () => {
		let finish!: () => void;
		const refresh = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
		const view = render(<DashboardHeader {...base} onRefresh={refresh} />);
		fireEvent.click(screen.getByRole("button", { name: "Refresh dashboard" }));
		view.rerender(<DashboardHeader {...base} onRefresh={refresh} activeTab="usage" />);
		await advance(120_000);
		expect(refresh).toHaveBeenCalledTimes(1);
		await act(async () => { finish(); });
		expect(screen.getByRole("button", { name: "Refresh dashboard" })).toBeEnabled();
	});

	it("recovers from a failed manual refresh without leaving the button busy", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const refresh = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
		render(<DashboardHeader {...base} onRefresh={refresh} />);
		await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Refresh dashboard" })); });
		expect(screen.getByRole("button", { name: "Refresh dashboard" })).toBeEnabled();
		await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Refresh dashboard" })); });
		expect(refresh).toHaveBeenCalledTimes(2);
	});

	it("does not mark failed data as a successful sync", () => {
		render(<DashboardHeader {...base} hasError refreshTick={1} />);
		expect(screen.getByText("SYNC FAILED")).toBeVisible();
		expect(screen.queryByText(/UPDATED/)).not.toBeInTheDocument();
	});
});
