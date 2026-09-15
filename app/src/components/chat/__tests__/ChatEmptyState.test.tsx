import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatEmptyState } from "../ChatEmptyState";

describe("ChatEmptyState", () => {
	it("keeps the first load focused on the message composer", () => {
		render(<ChatEmptyState />);
		expect(screen.getByText("Chat free on OMA-AI models")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Start with a question below. Guests get free messages on OMA-AI budget models.",
			),
		).toBeInTheDocument();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("hides guest quota copy when signed in", () => {
		render(<ChatEmptyState signedIn />);
		expect(screen.queryByText(/Guests get free messages/i)).toBeNull();
		expect(screen.queryByText(/20 requests\/day/i)).toBeNull();
		expect(screen.getByText("Chat with any model")).toBeInTheDocument();
		expect(
			screen.getByText("Start with a question below. Credits unlock the full catalog."),
		).toBeInTheDocument();
	});
});
