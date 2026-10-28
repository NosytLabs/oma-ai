import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UnifiedDepositInterface } from "../UnifiedDepositInterface";
import { getConnectedAccount, resetWalletDiscoveryForTests } from "@/lib/wallet";

const state = vi.hoisted(() => ({ userId: "wallet-owner-a" }));
const FIRST = "0x1111111111111111111111111111111111111111";
const SECOND = "0x2222222222222222222222222222222222222222";
vi.mock("@/lib/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, isDemo: false, user: { id: state.userId } }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/lib/api/deposit", () => ({ deposit: {
	instructions: async () => ({ depositAddress: "0x3333333333333333333333333333333333333333", network: "base", chainId: 8453, minDepositCents: 100, maxDepositCents: 10000, creditsPerCent: 1 }),
	list: async () => ({ deposits: [] }),
} }));
vi.mock("@/lib/framer-motion-client", () => ({
	AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
	m: { div: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div> },
}));
beforeEach(() => { state.userId = "wallet-owner-a"; resetWalletDiscoveryForTests(); sessionStorage.clear(); });
afterEach(() => { cleanup(); resetWalletDiscoveryForTests(); delete window.ethereum; });

it("does not let an old account's late connection replace the wallet used by the new account", async () => {
	let firstAuthorized = false;
	let finishConnection!: (accounts: string[]) => void;
	const first = { isMetaMask: true, request: async ({ method }: { method: string }) => {
		if (method === "eth_accounts") return firstAuthorized ? [FIRST] : [];
		if (method === "eth_chainId") return "0x2105";
		throw new Error(`Unexpected wallet request: ${method}`);
	} };
	const second = { isRabby: true, request: async ({ method }: { method: string }) => {
		if (method === "eth_requestAccounts") return new Promise<string[]>(resolve => { finishConnection = resolve; });
		if (method === "eth_accounts") return [SECOND];
		if (method === "eth_chainId") return "0x2105";
		throw new Error(`Unexpected wallet request: ${method}`);
	} };
	window.ethereum = { request: first.request, providers: [first, second] };
	const view = render(<UnifiedDepositInterface />);
	const select = await screen.findByLabelText("Wallet to connect");
	fireEvent.change(select, { target: { value: "Rabby-1" } });
	fireEvent.click(screen.getByRole("button", { name: "Connect Rabby" }));
	await waitFor(() => expect(finishConnection).toEqual(expect.any(Function)));
	firstAuthorized = true;
	state.userId = "wallet-owner-b";
	view.rerender(<UnifiedDepositInterface />);
	expect(await screen.findByTitle("Change wallet")).toHaveTextContent("0x1111…1111");
	await act(async () => { finishConnection([SECOND]); });
	expect(await getConnectedAccount()).toBe(FIRST);
	expect(screen.getByTitle("Change wallet")).toHaveTextContent("0x1111…1111");
});
