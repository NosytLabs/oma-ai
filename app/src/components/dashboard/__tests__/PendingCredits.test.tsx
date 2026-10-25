import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PendingCredits } from "../PendingCredits";
afterEach(cleanup);
describe("pending credit budgets", () => {
	it("keeps reserved and uncertain costs separate with fractional precision", () => {
		render(
			<PendingCredits reservedCents="0.0002" reconciliationCents="1.25" />,
		);
		expect(
			screen.getByText(/0\.0002 credits reserved for pending requests/),
		).toBeInTheDocument();
		expect(
			screen.getByText(/1\.25 credits need a cost review/),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Contact support" }),
		).toHaveAttribute("href", "/contact");
	});
	it("does not imply a charge or hold for an older balance response", () => {
		const { container } = render(<PendingCredits />);
		expect(container).toBeEmptyDOMElement();
	});
	it.each(["0.00000001", "9007199254740993.12345678"])("shows exact refund shortfall %s and a funding action", debtCents => {
		render(<PendingCredits debtCents={debtCents} />);
		expect(screen.getByText(new RegExp(`${debtCents.replaceAll(".", "\\.")} credits`))).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /top up/i })).toHaveAttribute("href", "/deposit");
	});
	it("does not show a shortfall for zero debt", () => {
		const { container } = render(<PendingCredits debtCents="0.00000000" />);
		expect(container).toBeEmptyDOMElement();
	});
});
