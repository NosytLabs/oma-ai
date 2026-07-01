import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Footer } from "@/components/footer";
import HomePage from "./page";

// Mock next/navigation — not exercised by static rendering of HomePage,
// but Footer + future child components may import usePathname.
vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/",
}));

// Mock framer-motion to disable all animations so content is always visible in tests.
// The new HomeView uses Reveal/RevealStagger which require viewport triggers.
vi.mock("@/lib/framer-motion-client", () => {
	// Map of motion tags to their HTML equivalents
	const TAG_MAP: Record<string, string> = {
		div: "div", section: "section", article: "article", span: "span",
		p: "p", ul: "ul", ol: "ol", li: "li", h1: "h1", h2: "h2",
		h3: "h3", button: "button", a: "a",
	};
	// Return an object whose properties return motion components that render real HTML elements
	// This preserves semantic elements (h1, etc.) for accessibility tests
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const m = new Proxy({} as Record<string, (props: { children?: React.ReactNode; className?: string }) => React.ReactElement>, {
		get: (_target, tag: string) => {
			const htmlTag = TAG_MAP[tag] ?? "div";
			// eslint-disable-next-line react/display-name
			return ({ children, className, ..._props }: { children?: React.ReactNode; className?: string }) =>
				React.createElement(htmlTag, { className }, children);
		},
	});
	return {
		m: m as unknown as typeof import("@/lib/framer-motion-client").m,
		useMotionValue: () => ({ get: () => 0 }),
		useReducedMotion: () => true,
		useSpring: () => ({ get: () => 0 }),
	};
});

const renderWithQueryClient = (ui: React.ReactElement) => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
	);
};

describe("HomePage (revamped 2026-06-30)", () => {
	it("renders the hero headline", async () => {
		renderWithQueryClient(<HomePage />);
		const h1 = await screen.findByRole("heading", { level: 1 });
		expect(h1).toBeInTheDocument();
		// Hero headline: "Run any model.\nPay per request."
		expect(screen.getByText(/pay per request/i)).toBeInTheDocument();
	});

	it("renders the primary CTA", async () => {
		renderWithQueryClient(<HomePage />);
		// New Hero CTA: "Get API Key" → /chat
		const ctaLinks = await screen.findAllByRole("link", {
			name: /get api key/i,
		});
		expect(ctaLinks.length).toBeGreaterThan(0);
		expect(ctaLinks[0]).toHaveAttribute("href", "/chat");
	});

	it("renders the docs CTA in the hero", async () => {
		renderWithQueryClient(<HomePage />);
		// New Hero secondary CTA: "View Docs" → /docs
		const docsLinks = await screen.findAllByRole("link", {
			name: /view docs/i,
		});
		expect(docsLinks.length).toBeGreaterThan(0);
		expect(docsLinks[0]).toHaveAttribute("href", "/docs");
	});

	it("renders the trust strip with partner logos", async () => {
		renderWithQueryClient(<HomePage />);
		await waitFor(() => {
			// New TrustStrip: "Works with the tools you ship on"
			expect(
				screen.getByText(/works with the tools you ship on/i),
			).toBeInTheDocument();
		});
	});

	it("renders the capabilities section", async () => {
		renderWithQueryClient(<HomePage />);
		await waitFor(() => {
			// New CapabilitiesGrid titles
			expect(screen.getByText("LLM Chat")).toBeInTheDocument();
			expect(screen.getByText("Image Generation")).toBeInTheDocument();
			expect(screen.getByText("Video Generation")).toBeInTheDocument();
			expect(screen.getByText("Model Routing")).toBeInTheDocument();
			expect(screen.getByText("Crypto-Native Billing")).toBeInTheDocument();
		});
	});

	it("renders the how-it-works steps", async () => {
		renderWithQueryClient(<HomePage />);
		await waitFor(() => {
			// All 3 step titles should appear somewhere on the page
			expect(screen.getByText(/sign in with wallet/i)).toBeInTheDocument();
			expect(screen.getByText(/pay per call with usdc/i)).toBeInTheDocument();
		});
		// "Get your API key" appears in both HowItWorks step 2 AND FinalCTA — just confirm at least 2 exist
		const apiKeyEls = screen.getAllByText(/get your api key/i);
		expect(apiKeyEls.length).toBeGreaterThanOrEqual(2);
	});

	it("renders the stats section with live signal", async () => {
		renderWithQueryClient(<HomePage />);
		await waitFor(() => {
			// Stats section has the live signal headline and per-1M-tokens metric
			const signalEl = screen.getByText(/live network signal/i);
			expect(signalEl).toBeInTheDocument();
			// Find the parent section and scope the per-1M query to it
			const section = signalEl.closest("section");
			expect(section).toBeInTheDocument();
			expect(within(section!).getByText(/1m tokens/i)).toBeInTheDocument();
		});
	});

	it("renders the x402 banner", async () => {
		renderWithQueryClient(<HomePage />);
		await waitFor(() => {
			expect(screen.getByText(/agents pay for themselves/i)).toBeInTheDocument();
			expect(
				screen.getByText(/no accounts\. no subscriptions\./i),
			).toBeInTheDocument();
		});
	});

	it("renders the final CTA section", async () => {
		renderWithQueryClient(<HomePage />);
		await waitFor(() => {
			expect(screen.getByText(/stop renting gpus/i)).toBeInTheDocument();
			expect(screen.getByText(/start shipping agents/i)).toBeInTheDocument();
		});
	});
});

describe("Footer (unchanged)", () => {
	it("renders product links", () => {
		renderWithQueryClient(<Footer />);
		expect(screen.getByText("models")).toBeInTheDocument();
		expect(screen.getByText("pricing")).toBeInTheDocument();
		expect(screen.getByText("docs")).toBeInTheDocument();
		expect(screen.getByText("chat")).toBeInTheDocument();
	});

	it("renders legal links", () => {
		renderWithQueryClient(<Footer />);
		expect(screen.getByText("terms")).toBeInTheDocument();
		expect(screen.getByText("privacy")).toBeInTheDocument();
	});

	it("renders OMA brand", () => {
		renderWithQueryClient(<Footer />);
		expect(screen.getByText("oma")).toBeInTheDocument();
	});

	it("renders GitHub link", () => {
		renderWithQueryClient(<Footer />);
		const githubLink = screen.getByText("github.com/oma-ai");
		expect(githubLink).toBeInTheDocument();
		expect(githubLink).toHaveAttribute("href", "https://github.com/oma-ai");
	});

	it("renders copyright", () => {
		renderWithQueryClient(<Footer />);
		expect(screen.getByText(/OMA AI/)).toBeInTheDocument();
	});
});
