import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrivacySection } from "./PrivacySection";

const mocks = vi.hoisted(() => ({ exportData: vi.fn(), toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api", () => ({ api: { exportData: { accountBundle: mocks.exportData } } }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => mocks.toast }));
const user = { id: "account-a", name: "A", email: "a@example.test", emailVerified: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
const bundle = new Blob([JSON.stringify({ account: "synthetic-account-a" })], { type: "application/json" });
const OriginalURL = URL;

beforeEach(() => {
	vi.clearAllMocks();
	mocks.exportData.mockResolvedValue(bundle);
	vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
	vi.stubGlobal("URL", class extends URL {
		static createObjectURL = vi.fn(() => "blob:private-bundle");
		static revokeObjectURL = vi.fn();
	});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.stubGlobal("URL", OriginalURL); });

describe("private account export lifetime", () => {
	it.each(["account change", "unmount"] as const)("cancels a download on %s even when the export adapter still resolves", async (boundary) => {
		let finish!: (value: Blob) => void;
		mocks.exportData.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
		const view = render(<PrivacySection user={user} />);
		fireEvent.click(screen.getByRole("button", { name: "Download JSON" }));
		const signal = mocks.exportData.mock.calls[0]?.[0] as AbortSignal | undefined;
		if (boundary === "unmount") view.unmount();
		else view.rerender(<PrivacySection user={{ ...user, id: "account-b" }} />);
		await act(async () => { finish(bundle); });
		expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
		expect(URL.createObjectURL).not.toHaveBeenCalled();
		expect(mocks.toast.success).not.toHaveBeenCalled();
		expect(signal?.aborted).toBe(true);
	});

	it("cleans up the download URL even when the browser rejects its click", async () => {
		vi.mocked(HTMLAnchorElement.prototype.click).mockImplementationOnce(() => { throw new Error("Download blocked"); });
		render(<PrivacySection user={user} />);
		await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Download JSON" })); });
		expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:private-bundle");
		expect(document.querySelector('a[download="oma-data-export-account-a.json"]')).toBeNull();
		expect(mocks.toast.error).toHaveBeenCalledWith("Download blocked");
		expect(screen.getByRole("button", { name: "Download JSON" })).toBeEnabled();
	});
});
