import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UnifiedDepositInterface } from "../UnifiedDepositInterface";

const mocks = vi.hoisted(() => ({ request: vi.fn(), send: vi.fn(), sign: vi.fn(), connect: vi.fn(), connected: true, userId: "deposit-test-user", toast: { success: vi.fn(), error: vi.fn() } }));
const ADDRESS = "0x0000000000000000000000000000000000000001" as const;
const RECEIVER = "0x0000000000000000000000000000000000000002";
const TX = `0x${"a".repeat(64)}`;
vi.mock("@/lib/api/client.js", () => ({ request: mocks.request, isAuthError: () => false }));
vi.mock("@/lib/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, isDemo: false, user: { id: mocks.userId } }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => mocks.toast }));
// The external wallet cannot transact in jsdom. Keep the real component's
// broadcast/proof/registration state transitions, replacing only these I/O calls.
vi.mock("@/lib/wallet", () => ({
 connectWallet: mocks.connect,
 ensureBaseChain: vi.fn(async () => {}),
 getConnectedAccount: vi.fn(async () => ADDRESS), hasWallet: () => true,
 sendUsdcTransfer: mocks.send, signDepositMessage: mocks.sign,
 subscribeWalletAccount: (listener: (address: typeof ADDRESS | null) => void) => { listener(mocks.connected ? ADDRESS : null); return () => {}; },
 listWallets: () => [{ id: "rabby", name: "Rabby" }, { id: "walletconnect", name: "WalletConnect" }],
 subscribeWallets: (listener: () => void) => { listener(); return () => {}; },
}));
vi.mock("@/lib/framer-motion-client", () => ({
 AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
 m: { div: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div> },
}));

async function pay() {
 render(<UnifiedDepositInterface />);
 const amount = await screen.findByLabelText("Amount (USD)");
 await waitFor(() => expect(screen.getByRole("button", { name: "Send 0 USDC" })).toBeDisabled());
 fireEvent.change(amount, { target: { value: "10" } });
 await waitFor(() => expect(screen.getByRole("button", { name: "Send 10 USDC" })).toBeEnabled());
 fireEvent.click(screen.getByRole("button", { name: "Send 10 USDC" }));
}

describe("USDC broadcast recovery", () => {
 beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); mocks.userId = "deposit-test-user"; mocks.connected = true;
  mocks.connect.mockResolvedValue({ address: ADDRESS, chainId: 8453 });
  mocks.send.mockResolvedValue({ txHash: TX }); mocks.sign.mockResolvedValue("0xproof");
  let nonce = 0;
  mocks.request.mockImplementation(async (path: string) => {
   if (path === "/v1/deposit/usdc/challenge") return { token: `challenge-${++nonce}`, nonce: String(nonce), expiresAt: Date.now() + 300_000 };
   if (path === "/v1/deposit/status") return { deposits: [] };
   if (path === "/v1/deposit/usdc") return { depositAddress: RECEIVER, network: "base", chainId: 8453, usdcContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", minDepositCents: 100, maxDepositCents: 1_000_000, creditsPerCent: 1 };
   throw new Error(`Unexpected API path: ${path}`);
  });
 });
 afterEach(cleanup);

 it("retains the broadcast transaction when its proof signature is rejected", async () => {
  mocks.sign.mockRejectedValueOnce(new Error("User rejected proof"));
  await pay();
  expect(await screen.findByRole("button", { name: "Retry registration" })).toBeEnabled();
  expect(screen.getByRole("link", { name: /view transfer/i })).toHaveAttribute("href", `https://basescan.io/tx/${TX}`);
  expect(mocks.send).toHaveBeenCalledOnce();
 });

 it("does not broadcast funds when the account-bound challenge cannot be issued", async () => {
  const original = mocks.request.getMockImplementation()!;
  mocks.request.mockImplementation(async (path: string, options: unknown) => {
   if (path.endsWith("/challenge")) throw new Error("Challenge service unavailable");
   return original(path, options);
  });
  await pay();
  await screen.findByText(/Challenge service unavailable/i);
  expect(mocks.send).not.toHaveBeenCalled();
 });

 it("refreshes an expired proof on retry without sending another transfer", async () => {
  const original = mocks.request.getMockImplementation()!; let attempts = 0;
  mocks.request.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
   if (path === "/v1/deposit/usdc" && options?.method === "POST") {
    if (++attempts === 1) throw new Error("Deposit challenge expired");
    expect(JSON.parse(options.body!)).toMatchObject({ txHash: TX, challengeToken: "challenge-2", amountUsd: 10 });
    return { depositId: "deposit-1", status: "pending", amountCents: 1000, txHash: TX, network: "base", message: "Deposit recorded" };
   }
   return original(path, options);
  });
  await pay();
  fireEvent.click(await screen.findByRole("button", { name: "Retry registration" }));
  expect(await screen.findByText("Deposit recorded")).toBeVisible();
  expect(mocks.sign).toHaveBeenCalledTimes(2);
  expect(mocks.send).toHaveBeenCalledOnce();
 });

 it("keeps recovery available after the page remounts", async () => {
  mocks.sign.mockRejectedValueOnce(new Error("User rejected proof"));
  await pay();
  await screen.findByRole("button", { name: "Retry registration" });
  cleanup();
  render(<UnifiedDepositInterface />);
  expect(await screen.findByRole("button", { name: "Retry registration" })).toBeEnabled();
  expect(screen.getByRole("link", { name: /view transfer/i })).toHaveAttribute("href", `https://basescan.io/tx/${TX}`);
  expect(mocks.send).toHaveBeenCalledOnce();
 });

 it("restores a transfer only for the account that broadcast it", async () => {
  mocks.sign.mockRejectedValueOnce(new Error("User rejected proof"));
  await pay();
  await screen.findByRole("button", { name: "Retry registration" });
  cleanup(); mocks.userId = "another-user";
  render(<UnifiedDepositInterface />);
  await screen.findByLabelText("Amount (USD)");
  expect(screen.queryByRole("button", { name: "Retry registration" })).toBeNull();
  cleanup(); mocks.userId = "deposit-test-user";
  render(<UnifiedDepositInterface />);
  expect(await screen.findByRole("button", { name: "Retry registration" })).toBeEnabled();
 });

 it("rejects fractional cents before broadcasting a transfer", async () => {
  render(<UnifiedDepositInterface />);
  fireEvent.change(await screen.findByLabelText("Amount (USD)"), { target: { value: "1.005" } });
  fireEvent.click(await screen.findByRole("button", { name: "Send 1.005 USDC" }));
  expect(await screen.findByText(/at most two decimal places/i)).toBeVisible();
  expect(mocks.send).not.toHaveBeenCalled();
 });

 it("accepts a leading-dot decimal and applies the configured minimum instead of a precision error", async () => {
  render(<UnifiedDepositInterface />);
  fireEvent.change(await screen.findByLabelText("Amount (USD)"), { target: { value: ".50" } });
  fireEvent.click(await screen.findByRole("button", { name: "Send .50 USDC" }));
  expect(await screen.findByText("Minimum deposit is $1.00")).toBeVisible();
  expect(screen.queryByText(/at most two decimal places/i)).toBeNull();
  expect(mocks.send).not.toHaveBeenCalled();
 });

 it("connects the wallet the depositor selects instead of the first extension", async () => {
  mocks.connected = false;
  render(<UnifiedDepositInterface />);
  fireEvent.change(await screen.findByLabelText("Wallet to connect"), { target: { value: "walletconnect" } });
  fireEvent.click(screen.getByRole("button", { name: "Connect WalletConnect" }));
  await waitFor(() => expect(mocks.connect).toHaveBeenCalledExactlyOnceWith("walletconnect"));
  expect(mocks.send).not.toHaveBeenCalled();
 });

 it("offers connection before retrying a saved transfer, without broadcasting again", async () => {
  mocks.sign.mockRejectedValueOnce(new Error("User rejected proof"));
  await pay(); await screen.findByRole("button", { name: "Retry registration" }); cleanup();
  mocks.connected = false;
  render(<UnifiedDepositInterface />);
  const retry = await screen.findByRole("button", { name: "Retry registration" });
  expect(retry).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Wallet to connect"), { target: { value: "walletconnect" } });
  fireEvent.click(screen.getByRole("button", { name: "Connect WalletConnect" }));
  await waitFor(() => expect(retry).toBeEnabled());
  expect(mocks.send).toHaveBeenCalledOnce();
 });
});
