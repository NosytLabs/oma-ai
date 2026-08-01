import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Footer } from "@/components/footer";
import HomePage from "./page";

// Mock next/navigation — Footer + future child components may import usePathname.
vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/",
}));

// Mock framer-motion so content is always visible in tests.
vi.mock("@/lib/framer-motion-client", () => {
	const TAG_MAP: Record<string, string> = {
		div: "div",
		section: "section",
		article: "article",
		span: "span",
		p: "p",
		ul: "ul",
		ol: "ol",
		li: "li",
		h1: "h1",
		h2: "h2",
		h3: "h3",
		button: "button",
		a: "a",
	};
	const m = new Proxy(
		{} as Record<
			string,
			(props: {
				children?: React.ReactNode;
				className?: string;
			}) => React.ReactElement
		>,
		{
			get: (_target, tag: string) => {
				const htmlTag = TAG_MAP[tag] ?? "div";
				return ({
					children,
					className,
					..._props
				}: {
					children?: React.ReactNode;
					className?: string;
				}) => React.createElement(htmlTag, { className }, children);
			},
		},
	);
	return {
		m: m as unknown as typeof import("@/lib/framer-motion-client").m,
		useMotionValue: () => ({ get: () => 0 }),
		useReducedMotion: () => true,
		useSpring: () => ({ get: () => 0 }),
		// useRevealInView reads useInView; always-truthy keeps content rendered
		// in tests without scroll/observer mocks.
		useInView: () => true,
	};
});

// Hero imports `m` from framer-motion directly — stub that too.
vi.mock("framer-motion", () => {
	const TAG_MAP: Record<string, string> = {
		div: "div",
		section: "section",
		h1: "h1",
		h2: "h2",
		p: "p",
		ul: "ul",
		li: "li",
		span: "span",
	};
	const m = new Proxy(
		{} as Record<
			string,
			(props: {
				children?: React.ReactNode;
				className?: string;
			}) => React.ReactElement
		>,
		{
			get: (_target, tag: string) => {
				const htmlTag = TAG_MAP[tag] ?? "div";
				return ({
					children,
					className,
				}: {
					children?: React.ReactNode;
					className?: string;
				}) => React.createElement(htmlTag, { className }, children);
			},
		},
	);
	return {
		m,
		motion: m,
		useReducedMotion: () => true,
		AnimatePresence: ({ children }: { children: React.ReactNode }) =>
			children,
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

describe("HomePage", () => {
	it("renders the hero headline", async () => {
		renderWithQueryClient(<HomePage />);
		const h1 = await screen.findByRole("heading", { level: 1 });
		expect(h1).toBeInTheDocument();
		// Headline is split across elements: "AI inference, paid per request in USDC."
		expect(h1.textContent).toMatch(/paid per request/i);
		expect(h1.textContent).toMatch(/USDC/i);
	});

	it("renders the primary CTA", async () => {
		renderWithQueryClient(<HomePage />);
		const ctaLinks = await screen.findAllByRole("link", {
			name: /get api key/i,
		});
		expect(ctaLinks.length).toBeGreaterThan(0);
		expect(ctaLinks[0]).toHaveAttribute("href", "/login");
	});

	it("renders the x402 pay-per-request CTA in the hero", async () => {
		renderWithQueryClient(<HomePage />);
		const docsLinks = await screen.findAllByRole("link", {
			name: /x402 pay-per-request/i,
		});
		expect(docsLinks.length).toBeGreaterThan(0);
		expect(docsLinks[0]).toHaveAttribute("href", "/docs#x402");
	});

	it("renders the trust strip with provider wordmarks", async () => {
		renderWithQueryClient(<HomePage />);
		await waitFor(() => {
			expect(screen.getByText(/routing through/i)).toBeInTheDocument();
			expect(screen.getAllByText("OpenAI").length).toBeGreaterThan(0);
			expect(screen.getAllByText("Venice").length).toBeGreaterThan(0);
		});
	});

	it("renders the capabilities section as three pillars", async () => {
		renderWithQueryClient(<HomePage />);
		await waitFor(() => {
			expect(screen.getByText("Pay with credits")).toBeInTheDocument();
			expect(screen.getByText("Agents pay per request")).toBeInTheDocument();
			expect(screen.getByText("Routing & privacy")).toBeInTheDocument();
			expect(screen.getByText("Pay with card")).toBeInTheDocument();
			expect(screen.getByText("USDC on Base deposit")).toBeInTheDocument();
		});
	});

	it("renders the how-it-works steps", async () => {
		renderWithQueryClient(<HomePage />);
		await waitFor(() => {
			expect(screen.getByText(/sign in with wallet/i)).toBeInTheDocument();
			expect(screen.getByText(/pay per call with usdc/i)).toBeInTheDocument();
		});
		expect(screen.getAllByText(/get your api key/i).length).toBeGreaterThan(0);
	});

	it("renders the agent session demo section", async () => {
		renderWithQueryClient(<HomePage />);
		await waitFor(() => {
			expect(screen.getByText(/looks like a coding agent/i)).toBeInTheDocument();
		});
	});

	it("renders the stats section with honest metrics", async () => {
		renderWithQueryClient(<HomePage />);
		await waitFor(() => {
			const signalEl = screen.getByText(/what is actually here/i);
			expect(signalEl).toBeInTheDocument();
			const section = signalEl.closest("section");
			expect(section).toBeInTheDocument();
			expect(within(section!).getByText(/1M tokens/i)).toBeInTheDocument();
		});
	});

	it("renders the x402 banner", async () => {
		renderWithQueryClient(<HomePage />);
		await waitFor(() => {
			expect(screen.getByText(/agents pay for themselves/i)).toBeInTheDocument();
			expect(
				screen.getByText(/wallet-based billing, no card needed/i),
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

describe("Footer", () => {
	it("renders product links", () => {
		renderWithQueryClient(<Footer />);
		expect(screen.getAllByText(/docs/i).length).toBeGreaterThan(0);
		expect(screen.getAllByText(/models/i).length).toBeGreaterThan(0);
		expect(screen.getAllByText(/pricing/i).length).toBeGreaterThan(0);
		// Product nav labels the free chat surface "Playground" (href=/chat)
		expect(screen.getAllByText(/playground/i).length).toBeGreaterThan(0);
	});

	it("renders legal links", () => {
		renderWithQueryClient(<Footer />);
		expect(screen.getAllByText(/terms/i).length).toBeGreaterThan(0);
		expect(screen.getAllByText(/privacy/i).length).toBeGreaterThan(0);
	});

	it("renders OMA brand", () => {
		renderWithQueryClient(<Footer />);
		expect(screen.getByText(/^oma$/i)).toBeInTheDocument();
	});

	it("renders GitHub link", () => {
		renderWithQueryClient(<Footer />);
		const githubLinks = screen.getAllByRole("link", {
			name: /github/i,
		});
		expect(githubLinks.length).toBeGreaterThan(0);
		expect(githubLinks[0]).toHaveAttribute("href", "https://github.com/NosytLabs/oma-ai");
	});

	it("renders copyright line with year + license", () => {
		renderWithQueryClient(<Footer />);
		expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0);
		expect(screen.getAllByText(/MIT/i).length).toBeGreaterThan(0);
	});
});
