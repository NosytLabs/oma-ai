import { cloneElement, type ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DonutChart } from "./DonutChart";

// jsdom has no layout. Supply dimensions while keeping the real chart and
// its accessible description so tiny billed amounts cannot appear as zero.
vi.mock("recharts", async importOriginal => ({
	...await importOriginal<typeof import("recharts")>(),
	ResponsiveContainer: ({ children }: { children: ReactElement }) => cloneElement(children, { width: 300, height: 280 } as object),
}));

describe("spend donut", () => {
	it("preserves a nonzero sub-cent charge in the total and accessible description", () => {
		render(<DonutChart data={[{ name: "MiniMax", value: 0.00002, color: "#00cc99" }]} />);
		expect(screen.getByText("$0.00002")).toBeInTheDocument();
		expect(screen.getByRole("img", { name: /MiniMax: \$0\.00002.*Total: \$0\.00002/ })).toBeInTheDocument();
		expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
	});

	it("keeps count charts free of currency labels", () => {
		render(<DonutChart currency={false} data={[{ name: "Requests", value: 42, color: "#00cc99" }]} />);
		expect(screen.getByText("42")).toBeInTheDocument();
		expect(screen.getByRole("img", { name: /Requests: 42.*Total: 42/ })).toBeInTheDocument();
	});
});
