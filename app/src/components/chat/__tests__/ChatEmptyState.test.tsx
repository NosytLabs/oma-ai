import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatEmptyState } from "../ChatEmptyState";

describe("ChatEmptyState", () => {
	it("keeps the first load focused on the message composer", () => {
		render(<ChatEmptyState />);
		expect(screen.getByText("Chat with any model")).toBeInTheDocument();
		expect(screen.getByText("Start with a question below. Guest chats are free on OMA-AI models.")).toBeInTheDocument();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("hides guest quota copy when signed in", () => {
		render(<ChatEmptyState signedIn />);
		expect(screen.queryByText(/Guest chats are free/i)).toBeNull();
		expect(screen.queryByText(/20 requests\/day/i)).toBeNull();
		expect(screen.getByText("Start with a question below.")).toBeInTheDocument();
	});
});
