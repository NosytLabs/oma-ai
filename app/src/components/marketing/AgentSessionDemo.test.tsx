import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentSessionDemo } from "./AgentSessionDemo";

describe("AgentSessionDemo", () => {
	it("renders the OMA agent terminal demo", () => {
		render(<AgentSessionDemo />);
		expect(
			screen.getByRole("figure", {
				name: /demo agent session calling the oma api/i,
			}),
		).toBeInTheDocument();
		expect(screen.getByText(/agent · oma gateway/i)).toBeInTheDocument();
		expect(screen.getByText(/demo · not live/i)).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /try live chat/i }),
		).toHaveAttribute("href", "/chat");
		expect(screen.getByRole("link", { name: /api docs/i })).toHaveAttribute(
			"href",
			"/docs",
		);
	});

	it("shows the OpenAI-compatible base URL in the transcript", () => {
		render(<AgentSessionDemo />);
		expect(screen.getAllByText(/api\.oma-ai\.com\/v1/i).length).toBeGreaterThan(
			0,
		);
	});
});
