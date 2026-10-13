import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import StatusPage from "./page";

vi.mock("@/lib/config", () => ({ DEFAULT_API_URL: "https://gateway.example" }));
vi.mock("@/components/json-ld", () => ({ BreadcrumbListJsonLd: () => null }));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

function mockGateway(ready: boolean, defaultModelAvailable = true) {
	vi.stubGlobal("fetch", vi.fn(async (url: string) => {
		if (url.endsWith("/health")) return Response.json({ status: "ok" });
		if (url.endsWith("/ready")) return Response.json({
			status: ready ? "ready" : "not_ready",
			checks: { database: { ok: true }, redis: { ok: ready } },
		}, { status: ready ? 200 : 503 });
		return Response.json({ data: [
			{ id: "minimax-m2-7", provider: "oma-ai", available: defaultModelAvailable },
			{ id: "deepseek-v4-flash-0731-openbroker", provider: "oma-ai", available: true },
		] });
	}));
}

describe("public service status", () => {
	it("reports a failed dependency even when liveness and the model catalog succeed", async () => {
		mockGateway(false);
		render(await StatusPage());
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Some services are degraded.");
		expect(screen.getByText(/Shared cache unavailable/)).toBeInTheDocument();
		expect(screen.queryByText("Gateway services are online.")).not.toBeInTheDocument();
	});

	it("checks the same default model as the playground", async () => {
		mockGateway(true, false);
		render(await StatusPage());
		expect(screen.getByText(/Paused — the default free model/)).toBeInTheDocument();
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Some services are degraded.");
	});

	it("reports normal status when readiness and the default model both succeed", async () => {
		mockGateway(true);
		render(await StatusPage());
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Gateway services are online.");
		expect(screen.getByText("Database and shared cache are ready.")).toBeInTheDocument();
	});
});
