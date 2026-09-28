import { createRef, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NavbarToolsDropdown } from "./NavbarToolsDropdown";
import { NavbarUserMenu } from "./NavbarUserMenu";
import { NavbarMobileMenu } from "./NavbarMobileMenu";
import { primaryLinks, toolsLinks } from "./_lib/nav-links";
import { ThemeToggle } from "../ThemeToggle";
import { ThemeProvider } from "../ThemeProvider";

const state = vi.hoisted(() => ({ pathname: "/docs" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("next/link", () => ({ default: ({ href, prefetch: _prefetch, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }) => <a href={href} {...props}>{children}</a> }));

beforeEach(() => { state.pathname = "/docs"; });
afterEach(() => { cleanup(); document.body.style.overflow = ""; });

function Tools() {
	const [open, setOpen] = useState(false);
	return <><NavbarToolsDropdown open={open} onOpenChange={setOpen} /><button>After navigation</button></>;
}

describe("desktop navigation disclosures", () => {
	it("opens with arrow keys, moves through links, and restores focus on Escape", async () => {
		render(<Tools />);
		const toggle = screen.getByRole("button", { name: "Tools menu" });
		toggle.focus();
		fireEvent.keyDown(toggle, { key: "ArrowDown" });
		const first = screen.getByRole("link", { name: /Buy credits/ });
		expect(first).toHaveFocus();
		fireEvent.keyDown(first, { key: "ArrowDown" });
		expect(screen.getByRole("link", { name: /API reference/ })).toHaveFocus();
		fireEvent.keyDown(document.activeElement!, { key: "End" });
		expect(screen.getByRole("link", { name: /FAQ/ })).toHaveFocus();
		fireEvent.keyDown(document.activeElement!, { key: "Escape" });
		expect(toggle).toHaveFocus();
		expect(toggle).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("link", { name: /FAQ/ })).not.toBeInTheDocument();
	});

	it("closes when keyboard focus leaves and does not claim docs fragments are current pages", () => {
		render(<Tools />);
		fireEvent.click(screen.getByRole("button", { name: "Tools menu" }));
		const first = screen.getByRole("link", { name: /Buy credits/ });
		first.focus();
		expect(screen.getByRole("link", { name: /API reference/ })).not.toHaveAttribute("aria-current");
		act(() => screen.getByRole("button", { name: "After navigation" }).focus());
		expect(screen.getByRole("button", { name: "Tools menu" })).toHaveAttribute("aria-expanded", "false");
	});


	it("keeps confirmation open across a native blur without a related focus target", async () => {
		const onSignOut = vi.fn().mockResolvedValue(undefined);
		render(<NavbarUserMenu evmAddress={null} email="member@example.com" onSignOut={onSignOut} />);
		const toggle = screen.getByRole("button", { name: "Account menu" });
		act(() => { toggle.focus(); toggle.click(); });
		const trigger = screen.getByRole("button", { name: "Sign out" });
		act(() => { trigger.focus(); trigger.click(); });
		const cancel = screen.getByRole("button", { name: "Cancel" });
		expect(cancel).toHaveFocus();
		// Browsers can blur to body between pointer down and the next focus.
		// A null relatedTarget is not evidence that the user left the menu.
		act(() => cancel.blur());
		expect(toggle).toHaveAttribute("aria-expanded", "true");
		const confirm = screen.getByRole("button", { name: "Sign out" });
		act(() => { confirm.focus(); confirm.click(); });
		await waitFor(() => expect(onSignOut).toHaveBeenCalledOnce());
		await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "false"));
	});

	it("supports account keyboard access and keeps a failed sign-out recoverable", async () => {
		const onSignOut = vi.fn().mockRejectedValue(new Error("offline"));
		render(<NavbarUserMenu evmAddress={null} email="member@example.com" onSignOut={onSignOut} />);
		const toggle = screen.getByRole("button", { name: "Account menu" });
		fireEvent.keyDown(toggle, { key: "ArrowUp" });
		expect(screen.getByRole("button", { name: "Sign out" })).toHaveFocus();
		fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
		expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
		fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Could not sign out"));
		expect(toggle).toHaveAttribute("aria-expanded", "true");
		fireEvent.keyDown(screen.getByRole("button", { name: "Cancel" }), { key: "Escape" });
		expect(toggle).toHaveFocus();
		expect(toggle).toHaveAttribute("aria-expanded", "false");
	});
});

describe("mobile navigation", () => {
	it("shares every destination without duplicate credits links and has a single current page", () => {
		render(<NavbarMobileMenu open onOpenChange={vi.fn()} toggleRef={createRef()} isConnected loginHref="/login?next=%2Fdocs" />);
		const nav = screen.getByRole("navigation", { name: "Mobile navigation" });
		for (const link of [...primaryLinks, ...toolsLinks]) {
			expect(within(nav).getByRole("link", { name: link.label })).toHaveAttribute("href", link.href);
		}
		expect(within(nav).getAllByRole("link", { name: "Buy credits" })).toHaveLength(1);
		expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
		expect(within(nav).getByRole("link", { name: "Docs" })).toHaveAttribute("aria-current", "page");
	});

	it("preserves an existing scroll lock when closed or dismissed", async () => {
		document.body.style.overflow = "clip";
		const toggleRef = createRef<HTMLButtonElement>();
		function Mobile() {
			const [open, setOpen] = useState(false);
			return <><button ref={toggleRef} onClick={() => setOpen(true)}>Open navigation</button><NavbarMobileMenu open={open} onOpenChange={setOpen} toggleRef={toggleRef} isConnected={false} loginHref="/login?next=%2Fdocs" /></>;
		}
		render(<Mobile />);
		expect(document.body.style.overflow).toBe("clip");
		fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
		expect(document.body.style.overflow).toBe("hidden");
		await waitFor(() => expect(screen.getByRole("button", { name: "Close navigation menu" })).toHaveFocus());
		expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?next=%2Fdocs");
		fireEvent.keyDown(document, { key: "Escape" });
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(document.body.style.overflow).toBe("clip");
		expect(toggleRef.current).toHaveFocus();
	});
});


describe("accent theme menu", () => {
	beforeEach(() => { localStorage.removeItem("oma-theme"); });
	it("focuses the selected theme, supports arrows and typeahead, and saves a choice", () => {
		render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
		const toggle = screen.getByRole("button", { name: /Change accent theme/ });
		fireEvent.click(toggle);
		expect(screen.getByRole("menuitemradio", { name: "Emerald" })).toHaveFocus();
		fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
		expect(screen.getByRole("menuitemradio", { name: "Synth" })).toHaveFocus();
		fireEvent.keyDown(document.activeElement!, { key: "Home" });
		expect(screen.getByRole("menuitemradio", { name: "Emerald" })).toHaveFocus();
		fireEvent.keyDown(document.activeElement!, { key: "a" });
		expect(screen.getByRole("menuitemradio", { name: "Amber" })).toHaveFocus();
		fireEvent.click(screen.getByRole("menuitemradio", { name: "Amber" }));
		expect(toggle).toHaveFocus();
		expect(document.documentElement).toHaveAttribute("data-theme", "amber");
		fireEvent.click(toggle);
		expect(screen.getByRole("menuitemradio", { name: "Amber" })).toHaveFocus();
		expect(screen.getByRole("menuitemradio", { name: "Amber" })).toHaveAttribute("aria-checked", "true");
		fireEvent.keyDown(document.activeElement!, { key: "Escape" });
		expect(toggle).toHaveFocus();
		expect(screen.queryByRole("menu")).not.toBeInTheDocument();
	});

	it("opens at the last option with ArrowUp and dismisses on Tab", () => {
		render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
		const toggle = screen.getByRole("button", { name: /Change accent theme/ });
		fireEvent.keyDown(toggle, { key: "ArrowUp" });
		expect(screen.getByRole("menuitemradio", { name: "Synth" })).toHaveFocus();
		fireEvent.keyDown(document.activeElement!, { key: "Tab" });
		expect(screen.queryByRole("menu")).not.toBeInTheDocument();
		expect(toggle).toHaveFocus();
	});
});
