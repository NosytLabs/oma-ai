import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CreditTransaction } from "@/lib/api";
import { RecentTransactions } from "./RecentTransactions";

afterEach(cleanup);
const transactions: CreditTransaction[] = [{
	id: "test-usage", type: "usage", amountCents: -0.000006,
	status: "completed", createdAt: "2026-10-11T00:00:00Z",
}];

describe("recent activity navigation", () => {
	it.each([true, false])("keeps usage details in the current account mode (demo=%s)", isDemo => {
		render(<RecentTransactions transactions={transactions} isDemo={isDemo} />);
		const link = screen.getByRole("link", { name: /Usage details/ });
		const url = new URL(link.getAttribute("href")!, "https://www.oma-ai.com");
		expect(url.searchParams.get("tab")).toBe("usage");
		expect(url.searchParams.get("demo")).toBe(isDemo ? "1" : null);
	});
});
