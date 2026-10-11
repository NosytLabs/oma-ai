import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatsBar } from "./PlaygroundComponents";

describe("chat session statistics", () => {
	it("shows message and token totals without presenting website tokens as an API charge", () => {
		render(<StatsBar messages={[
			{ role: "user", content: "Hello", timestamp: 1 },
			{ role: "assistant", content: "Hi", timestamp: 2, model: "minimax-m2-7", tokens: 117, inputTokens: 50, outputTokens: 67 },
		]} />);
		expect(screen.getByText("01")).toBeInTheDocument();
		expect(screen.getByText("0117")).toBeInTheDocument();
		expect(screen.queryByText("CST")).not.toBeInTheDocument();
		expect(screen.queryByText(/FREE|\$/)).not.toBeInTheDocument();
	});
});
