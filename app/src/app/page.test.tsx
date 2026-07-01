import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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
		// Hero headline contains the signature phrase
		expect(screen.getByText(/pay per request/i)).toBeInTheDocument();
	});

	it("renders the primary CTA", async () => {
		renderWithQueryClient(<HomePage />);
		const ctaLinks = await screen.findAllByRole("link", {
			name: /get api key|get your api key/i,
		});
		expect(ctaLinks.length).toBeGreaterThan(0);
		// Hero CTA points to /chat (the product entry point)
		expect(ctaLinks[0]).toHaveAttribute("href", "/chat");
	});

	it("renders the docs CTA in the hero", async () => {
		renderWithQueryClient(<HomePage />);
		const docsLinks = await screen.findAllByRole("link", {
			name: /view docs/i,
		});
		expect(docsLinks.length).toBeGreaterThan(0);
		expect(docsLinks[0]).toHaveAttribute("href", "/docs");
	});

	it("renders the trust strip with partner logos", async () => {
		renderWithQueryClient(<HomePage />);
		await waitFor(() => {
			expect(
				screen.getByText(/works with the tools you ship on/i),
			).toBeInTheDocument();
		});
	});

	it("renders the capabilities section", async () => {
		renderWithQueryClient(<HomePage />);
		await waitFor(() => {
			expect(screen.getByText(/llm chat/i)).toBeInTheDocument();
			expect(screen.getByText(/image generation/i)).toBeInTheDocument();
			expect(screen.getByText(/video generation/i)).toBeInTheDocument();
			expect(screen.getByText(/model routing/i)).toBeInTheDocument();
			expect(screen.getByText(/crypto-native billing/i)).toBeInTheDocument();
		});
	});

	it("renders the how-it-works steps", async () => {
		renderWithQueryClient(<HomePage />);
		await waitFor(() => {
			expect(screen.getByText(/sign in with wallet/i)).toBeInTheDocument();
			expect(screen.getByText(/get your api key/i)).toBeInTheDocument();
			expect(screen.getByText(/pay per call with usdc/i)).toBeInTheDocument();
		});
	});

	it("renders the stats section with live signal", async () => {
		renderWithQueryClient(<HomePage />);
		await waitFor(() => {
			expect(screen.getByText(/live network signal/i)).toBeInTheDocument();
			expect(screen.getByText(/per 1m tokens/i)).toBeInTheDocument();
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
