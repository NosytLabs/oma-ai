import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InViewFade } from "../in-view-fade";

vi.mock("@/lib/framer-motion-client", () => ({
	useReducedMotion: () => false,
	useInView: () => false, // never intersects — would stay opacity 0 without eager/fallback
	m: {
		div: ({
			children,
			style,
			...rest
		}: React.PropsWithChildren<Record<string, unknown>>) => (
			<div data-testid="motion" style={style as React.CSSProperties} {...rest}>
				{children}
			</div>
		),
	},
}));

describe("InViewFade", () => {
	it("eager mode paints children immediately without opacity-0 motion wrapper", () => {
		render(
			<InViewFade eager>
				<span>Model card</span>
			</InViewFade>,
		);
		expect(screen.getByText("Model card")).toBeInTheDocument();
		// eager path uses a plain div, not the motion shell that starts at opacity 0
		expect(screen.queryByTestId("motion")).toBeNull();
	});
});
