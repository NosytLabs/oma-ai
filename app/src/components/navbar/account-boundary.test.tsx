import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Navbar } from "../navbar";

const state = vi.hoisted(() => ({ userId: "account-a", signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/docs", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ href, prefetch: _prefetch, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, isDemo: false, isPending: false, evmAddress: null, user: { id: state.userId, email: `${state.userId}@example.test` }, signOut: state.signOut }) }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
beforeEach(() => { vi.clearAllMocks(); state.userId = "account-a"; });
afterEach(() => { cleanup(); document.body.style.overflow = ""; });

describe("navigation account boundary", () => {
	it.each(["desktop", "mobile"] as const)("requires a fresh %s sign-out confirmation after switching accounts", (layout) => {
		const view = render(<Navbar />);
		const open = () => fireEvent.click(screen.getByRole("button", { name: layout === "desktop" ? "Account menu" : "Open navigation menu" }));
		open();
		const scope = () => layout === "mobile" ? within(screen.getByRole("dialog", { name: "Navigation" })) : screen;
		fireEvent.click(scope().getByRole("button", { name: "Sign out" }));
		expect(scope().getByRole("group", { name: "Sign out of OMA?" })).toBeInTheDocument();
		view.rerender(<Navbar />);
		expect(scope().getByRole("group", { name: "Sign out of OMA?" })).toBeInTheDocument();
		state.userId = "account-b";
		act(() => { view.rerender(<Navbar />); });
		expect(screen.queryByRole("group", { name: "Sign out of OMA?" })).not.toBeInTheDocument();
		open();
		fireEvent.click(scope().getByRole("button", { name: "Sign out" }));
		expect(scope().getByRole("group", { name: "Sign out of OMA?" })).toBeInTheDocument();
		expect(state.signOut).not.toHaveBeenCalled();
	});
});
