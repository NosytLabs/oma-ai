import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatEmptyState } from "../ChatEmptyState";

describe("ChatEmptyState", () => {
	it("describes the selected paid model without advertising free messages", () => {
		const chooseFree = vi.fn();
		render(<ChatEmptyState modelName="Claude Opus 5" guestAccess="sign-in" loginHref="/login?next=%2Fchat%3Fmodel%3Dclaude-opus-5" onChooseFreeModel={chooseFree} freeModelName="GLM-5.3 Flash" />);
		expect(screen.getByRole("heading")).toHaveTextContent("Chat with Claude Opus 5");
		expect(screen.getByText(/requires sign-in and credits/i)).toBeInTheDocument();
		expect(screen.queryByText(/requests\/day/i)).not.toBeInTheDocument();
		expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login?next=%2Fchat%3Fmodel%3Dclaude-opus-5");
		fireEvent.click(screen.getByRole("button", { name: /try GLM-5.3 Flash free/i }));
		expect(chooseFree).toHaveBeenCalledOnce();
	});

	it("shows quota only for a verified free selection", () => {
		render(<ChatEmptyState modelName="GLM-5.3 Flash" guestAccess="free" dailyLimit={12} />);
		expect(screen.getByText(/12 requests\/day/i)).toBeInTheDocument();
	});

	it("avoids free claims when model access is not yet known", () => {
		render(<ChatEmptyState modelName="Claude Opus 5" />);
		expect(screen.queryByText(/free|requests\/day/i)).not.toBeInTheDocument();
	});

	it("hides guest quota copy when signed in", () => {
		render(<ChatEmptyState signedIn modelName="Claude Opus 5" guestAccess="free" />);
		expect(screen.queryByText(/requests\/day/i)).not.toBeInTheDocument();
		expect(screen.getByRole("heading")).toHaveTextContent("Chat with Claude Opus 5");
	});
});
