import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AlertBanner } from "../alert-banner";

describe("AlertBanner", () => {
	it("renders error variant with message and alert role", () => {
		render(<AlertBanner variant="error" message="Something went wrong" />);

		expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
	});

	it("renders success variant with status role", () => {
		render(<AlertBanner variant="success" message="Saved successfully" />);

		expect(screen.getByRole("status")).toHaveTextContent("Saved successfully");
	});

	it("renders title when provided", () => {
		render(
			<AlertBanner
				variant="error"
				title="Error title"
				message="Error message"
			/>,
		);

		expect(screen.getByText("Error title")).toBeInTheDocument();
		expect(screen.getByText("Error message")).toBeInTheDocument();
	});

	it("calls onDismiss when dismiss button is clicked", () => {
		const handleDismiss = vi.fn();
		render(
			<AlertBanner
				variant="success"
				message="Saved"
				onDismiss={handleDismiss}
			/>,
		);

		const button = screen.getByRole("button", { name: "Dismiss alert" });
		fireEvent.click(button);
		expect(handleDismiss).toHaveBeenCalledTimes(1);
	});

	it("does not render dismiss button when onDismiss is omitted", () => {
		render(<AlertBanner variant="error" message="Error" />);

		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});
});
