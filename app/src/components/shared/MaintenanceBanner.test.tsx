import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MaintenanceBanner } from "./MaintenanceBanner";

vi.mock("next/link", () => ({ default: ({ children, href, className }: ComponentProps<"a">) => <a href={href} className={className}>{children}</a> }));

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("service notices", () => {
	it("warns visitors when account services cannot load settings", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => Response.json({ maintenanceMode: false, paymentStatusAvailable: false })));
		render(<MaintenanceBanner />);
		expect(await screen.findByRole("status")).toHaveTextContent(/temporarily unavailable/i);
		expect(screen.getByRole("link", { name: /service status/i })).toHaveAttribute("href", "/status");
	});

	it("preserves an operator's maintenance message", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => Response.json({ maintenanceMode: true, maintenanceMessage: "Payment maintenance until 22:00 UTC." })));
		render(<MaintenanceBanner />);
		expect(await screen.findByRole("status")).toHaveTextContent("Payment maintenance until 22:00 UTC.");
	});

	it("clears a recovered outage and shows a later outage after dismissal", async () => {
		vi.useFakeTimers();
		let available = false;
		vi.stubGlobal("fetch", vi.fn(async () => Response.json({ maintenanceMode: false, paymentStatusAvailable: available })));
		await act(async () => { render(<MaintenanceBanner />); });
		expect(screen.getByRole("status")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
		available = true;
		await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
		available = false;
		await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
		expect(screen.getByRole("status")).toBeInTheDocument();
		available = true;
		await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});
});
