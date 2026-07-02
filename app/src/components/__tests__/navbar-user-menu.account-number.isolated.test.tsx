/**
 * Tests for `NavbarUserMenu` — specifically the changes that let
 * account-number-only users see and use the menu.
 *
 * Pre-audit behavior: `NavbarUserMenu` returned `null` whenever
 * `evmAddress` was undefined. Account-number users (no wallet, just a
 * 16-digit number) therefore had no way to log out from the desktop
 * navbar — they were authenticated (`isConnected === true`) but the
 * menu was hidden.
 *
 * Post-audit: the menu renders for any connected user, with a
 * truncated account number as the trigger label, an `account-number`
 * subhead in the session panel, and an inline confirmation prompt
 * before disconnect.
 */

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
	usePathname: () => "/",
	useSearchParams: () => new URLSearchParams(),
}));

vi.mock("framer-motion", async (importOriginal) => {
	const actual = await importOriginal<typeof import("framer-motion")>();
	const passthrough = ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => (
		<div {...(props as Record<string, unknown>)}>{children}</div>
	);
	return {
		...actual,
		m: { ...actual.m, div: passthrough, span: passthrough },
		AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
		useReducedMotion: () => true,
	};
});

import { NavbarUserMenu } from "../navbar/NavbarUserMenu";

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("NavbarUserMenu — account-number users", () => {
	it("renders for account-number-only users (no evmAddress)", () => {
		const onDisconnect = vi.fn();
		render(
			<NavbarUserMenu
				evmAddress={undefined}
				authMethod="account-number"
				accountNumber="1234567890123456"
				onDisconnect={onDisconnect}
			/>,
		);
		// The trigger must be present.
		const trigger = screen.getByRole("button", { name: /open user menu/i });
		expect(trigger).toBeInTheDocument();
		// The trigger label should show a truncated form of the account
		// number, never the full secret.
		expect(trigger.textContent).toMatch(/1234/);
		expect(trigger.textContent).toMatch(/3456/);
		expect(trigger.textContent).not.toMatch(/1234567890123456/);
	});

	it("mentions account-number login in the session panel", () => {
		render(
			<NavbarUserMenu
				evmAddress={undefined}
				authMethod="account-number"
				accountNumber="1234567890123456"
				onDisconnect={vi.fn()}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: /open user menu/i }));
		expect(screen.getByText(/account-number login/i)).toBeInTheDocument();
	});

	it("shows the wallet-style confirmation copy for EVM users", () => {
		render(
			<NavbarUserMenu
				evmAddress="0xabcdef0123456789abcdef0123456789abcdef01"
				authMethod="siwe"
				accountNumber={null}
				onDisconnect={vi.fn()}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: /open user menu/i }));
		// The terminate-session item is a `role="menuitem"` button (not a
		// bare `<button>`). Query by role to match the rendered tree.
		fireEvent.click(screen.getByRole("menuitem", { name: /terminate session/i }));
		// SIWE users get the wallet recovery hint.
		expect(
			screen.getByText(/you'?ll need your wallet to sign back in/i),
		).toBeInTheDocument();
	});

	it("shows the account-number-specific copy when the session is account-number-based", () => {
		render(
			<NavbarUserMenu
				evmAddress={undefined}
				authMethod="account-number"
				accountNumber="1234567890123456"
				onDisconnect={vi.fn()}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: /open user menu/i }));
		fireEvent.click(screen.getByRole("menuitem", { name: /terminate session/i }));
		// Account-number users get the stronger "no recovery" hint.
		expect(
			screen.getByText(/there's no recovery/i),
		).toBeInTheDocument();
	});

	it("requires confirmation before invoking onDisconnect", async () => {
		const onDisconnect = vi.fn();
		render(
			<NavbarUserMenu
				evmAddress={undefined}
				authMethod="account-number"
				accountNumber="1234567890123456"
				onDisconnect={onDisconnect}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: /open user menu/i }));
		// Terminate-session trigger alone MUST NOT disconnect.
		fireEvent.click(screen.getByRole("menuitem", { name: /terminate session/i }));
		expect(onDisconnect).not.toHaveBeenCalled();

		// Cancel keeps us logged in.
		fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
		expect(onDisconnect).not.toHaveBeenCalled();

		// Reopen + confirm.
		fireEvent.click(screen.getByRole("menuitem", { name: /terminate session/i }));
		fireEvent.click(screen.getByRole("button", { name: /^sign out$/i }));
		await waitFor(() => {
			expect(onDisconnect).toHaveBeenCalledTimes(1);
		});
	});

	it("renders the short wallet address when evmAddress is set", () => {
		render(
			<NavbarUserMenu
				evmAddress="0xabcdef0123456789abcdef0123456789abcdef01"
				authMethod="siwe"
				accountNumber={null}
				onDisconnect={vi.fn()}
			/>,
		);
		const trigger = screen.getByRole("button", { name: /open user menu/i });
		expect(trigger.textContent).toMatch(/0xabcd/);
		expect(trigger.textContent).toMatch(/ef01/);
		expect(trigger.textContent).not.toMatch(/0123456789abcdef01/);
	});
});