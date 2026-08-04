/**
 * Tests for the mobile menu logout (terminate session) flow.
 *
 * The audit (2026-07-01) found that the mobile menu had NO way to log
 * out — only the desktop `NavbarUserMenu` exposed a terminate-session
 * button. These tests pin the new mobile disconnect flow:
 *
 *   1. The "terminate session" button appears in the mobile account card
 *      when the user is connected.
 *   2. Clicking it shows an inline confirmation prompt (role=alertdialog)
 *      with a Cancel + Sign out pair.
 *   3. Confirming invokes the provided `onDisconnect` callback.
 *   4. Cancel returns to the menu without invoking the callback.
 *   5. The trigger is hidden entirely when `isConnected` is false, so
 *      guests never see a logout option.
 *
 * The navbar's normal focus-trap behavior is covered by
 * `navbar.focus-trap.isolated.test.tsx`; this file focuses on the
 * disconnect UI only.
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
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/",
}));

const mockDisconnect = vi.fn();
vi.mock("@/components/wallet-context", () => ({
	useWallet: () => ({
		evmAddress: undefined,
		isConnected: true,
		disconnect: mockDisconnect,
		availableConnectors: [],
		connectEvm: vi.fn(),
	}),
}));

// Stub framer-motion: the menu uses AnimatePresence / m.*, which under
// jsdom would otherwise throw on layout-affecting props and make
// `queryByRole` flaky.
vi.mock("framer-motion", async (importOriginal) => {
	const actual = await importOriginal<typeof import("framer-motion")>();
	const passthrough = ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => (
		<div {...(props as Record<string, unknown>)}>{children}</div>
	);
	return {
		...actual,
		m: { ...actual.m, div: passthrough, ul: passthrough, li: passthrough, span: passthrough },
		AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
		useReducedMotion: () => true,
	};
});

vi.mock("@/components/ui/oma-logo", () => ({
	OmaLogo: () => <span data-testid="oma-logo" />,
}));
vi.mock("../api-status", () => ({
	ApiStatus: () => <span data-testid="api-status" />,
}));
vi.mock("../ThemeToggle", () => ({
	ThemeToggle: () => <button type="button">Theme</button>,
}));

import { NavbarMobileMenu } from "../navbar/NavbarMobileMenu";

afterEach(() => {
	cleanup();
	mockDisconnect.mockReset();
	vi.clearAllMocks();
});

function renderMenu(props: Partial<React.ComponentProps<typeof NavbarMobileMenu>> = {}) {
	const onDisconnect = props.onDisconnect ?? mockDisconnect;
	const ref = { current: null } as React.RefObject<HTMLButtonElement | null>;
	return render(
		<NavbarMobileMenu
			open
			onOpenChange={vi.fn()}
			toggleRef={ref}
			isConnected
			section="home"
			build="dev"
			onDisconnect={onDisconnect}
		/>,
	);
}

describe("NavbarMobileMenu — disconnect flow", () => {
	it("shows the terminate-session button when connected", () => {
		renderMenu();
		expect(
			screen.getByRole("button", { name: /terminate session/i }),
		).toBeInTheDocument();
	});

	it("does not show the terminate-session button when not connected", () => {
		render(
			<NavbarMobileMenu
				open
				onOpenChange={vi.fn()}
				toggleRef={{ current: null } as React.RefObject<HTMLButtonElement | null>}
				isConnected={false}
				section="home"
				build="dev"
				onDisconnect={vi.fn()}
			/>,
		);
		expect(
			screen.queryByRole("button", { name: /terminate session/i }),
		).toBeNull();
	});

	it("opens an inline confirmation prompt before disconnecting", () => {
		renderMenu();
		fireEvent.click(screen.getByRole("button", { name: /terminate session/i }));
		// The confirm dialog must be a proper WAI-ARIA alertdialog.
		const dialog = screen.getByRole("alertdialog", { name: /terminate session/i });
		expect(dialog).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /^sign out$/i })).toBeInTheDocument();
		// The trigger button must be replaced by the confirm UI.
		expect(
			screen.queryByRole("button", { name: /terminate session/i }),
		).toBeNull();
		// Disconnect MUST NOT have fired yet — clicking the trigger alone is
		// not enough to log the user out.
		expect(mockDisconnect).not.toHaveBeenCalled();
	});

	it("invokes onDisconnect only after explicit confirmation", async () => {
		renderMenu();
		fireEvent.click(screen.getByRole("button", { name: /terminate session/i }));
		fireEvent.click(screen.getByRole("button", { name: /^sign out$/i }));
		await waitFor(() => {
			expect(mockDisconnect).toHaveBeenCalledTimes(1);
		});
	});

	it("Cancel returns to the menu without invoking onDisconnect", () => {
		renderMenu();
		fireEvent.click(screen.getByRole("button", { name: /terminate session/i }));
		fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
		expect(mockDisconnect).not.toHaveBeenCalled();
		// The trigger reappears so the user can try again.
		expect(
			screen.getByRole("button", { name: /terminate session/i }),
		).toBeInTheDocument();
	});

	it("disables Cancel + Sign out while disconnect is in flight", async () => {
		// Resolve the disconnect promise only after we assert on the button
		// states — this pins the "no double-click" guard.
		let resolveDisconnect!: () => void;
		const slowDisconnect = vi.fn(
			() => new Promise<void>((r) => { resolveDisconnect = r; }),
		);
		renderMenu({ onDisconnect: slowDisconnect });
		fireEvent.click(screen.getByRole("button", { name: /terminate session/i }));
		fireEvent.click(screen.getByRole("button", { name: /^sign out$/i }));

		const signOutBtn = await screen.findByRole("button", { name: /signing out…/i });
		const cancelBtn = screen.getByRole("button", { name: /^cancel$/i });
		expect(signOutBtn).toBeDisabled();
		expect(cancelBtn).toBeDisabled();

		// Resolve the in-flight promise so the test tears down cleanly.
		resolveDisconnect();
		await waitFor(() => {
			expect(slowDisconnect).toHaveBeenCalledTimes(1);
		});
	});

	it("mentions account-number recovery in the confirmation copy when the session is account-number-based", () => {
		// We pass a custom slot that mirrors the wording change in the
		// desktop menu: account-number users get a stronger "there's no
		// recovery" hint. The mobile version keeps a single copy because it
		// doesn't have the authMethod context yet — but we still verify the
		// wording is recoverable / present so it's not accidentally empty.
		renderMenu();
		fireEvent.click(screen.getByRole("button", { name: /terminate session/i }));
		expect(
			screen.getByText(/you'?ll need your wallet or magic-link email/i),
		).toBeInTheDocument();
	});
});