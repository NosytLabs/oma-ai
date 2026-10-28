import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UnifiedDepositInterface } from "../UnifiedDepositInterface";
import { readPendingDeposit, savePendingDeposit } from "@/lib/deposit-recovery";
import { StrictMode } from "react";

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
 listWallets: () => [{ id: "rabby", name: "Rabby" }, { id: "metamask", name: "MetaMask" }],
 subscribeWallets: (listener: () => void) => { listener(); return () => {}; },
}));
vi.mock("@/lib/framer-motion-client", () => ({
 AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
 m: { div: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div> },
}));

async function pay(strictMode = false) {
 const view = render(<UnifiedDepositInterface />, strictMode ? { wrapper: StrictMode } : undefined);
 const amount = await screen.findByLabelText("Amount (USD)");
 await waitFor(() => expect(screen.getByRole("button", { name: "Send 0 USDC" })).toBeDisabled());
 fireEvent.change(amount, { target: { value: "10" } });
 await waitFor(() => expect(screen.getByRole("button", { name: "Send 10 USDC" })).toBeEnabled());
 fireEvent.click(screen.getByRole("button", { name: "Send 10 USDC" }));
 return view;
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
  fireEvent.change(await screen.findByLabelText("Wallet to connect"), { target: { value: "metamask" } });
  fireEvent.click(screen.getByRole("button", { name: "Connect MetaMask" }));
  await waitFor(() => expect(mocks.connect).toHaveBeenCalledExactlyOnceWith("metamask"));
  expect(mocks.send).not.toHaveBeenCalled();
 });

 it("offers connection before retrying a saved transfer, without broadcasting again", async () => {
  mocks.sign.mockRejectedValueOnce(new Error("User rejected proof"));
  await pay(); await screen.findByRole("button", { name: "Retry registration" }); cleanup();
  mocks.connected = false;
  render(<UnifiedDepositInterface />);
  const retry = await screen.findByRole("button", { name: "Retry registration" });
  expect(retry).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Wallet to connect"), { target: { value: "metamask" } });
  fireEvent.click(screen.getByRole("button", { name: "Connect MetaMask" }));
  await waitFor(() => expect(retry).toBeEnabled());
  expect(mocks.send).toHaveBeenCalledOnce();
 });

 it("clears the amount and reloads deposit history when the signed-in account changes", async () => {
  const view = render(<UnifiedDepositInterface />);
  fireEvent.change(await screen.findByLabelText("Amount (USD)"), { target: { value: "10" } });
  const previousRequests = mocks.request.mock.calls.filter(([path]) => path === "/v1/deposit/status").length;
  mocks.userId = "another-user";
  view.rerender(<UnifiedDepositInterface />);
  expect(await screen.findByLabelText("Amount (USD)")).toHaveValue("");
  await waitFor(() => expect(mocks.request.mock.calls.filter(([path]) => path === "/v1/deposit/status")).toHaveLength(previousRequests + 1));
 });

 it("does not open a transfer after the initiating account changes while its challenge is loading", async () => {
  let finishChallenge!: (value: unknown) => void;
  const original = mocks.request.getMockImplementation()!;
  mocks.request.mockImplementation((path: string, options: unknown) => path.endsWith("/challenge")
   ? new Promise(resolve => { finishChallenge = resolve; }) : original(path, options));
  const view = await pay();
  mocks.userId = "another-user";
  view.rerender(<UnifiedDepositInterface />);
  await act(async () => { finishChallenge({ token: "old-account-challenge" }); });
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.sign).not.toHaveBeenCalled();
 });

 it("does not show a previous account's history when its response arrives late", async () => {
  let finishHistory!: (value: unknown) => void;
  const original = mocks.request.getMockImplementation()!;
  let histories = 0;
  mocks.request.mockImplementation((path: string, options: unknown) => path === "/v1/deposit/status" && ++histories === 1
   ? new Promise(resolve => { finishHistory = resolve; }) : original(path, options));
  const view = render(<UnifiedDepositInterface />);
  await screen.findByLabelText("Amount (USD)");
  mocks.userId = "another-user";
  view.rerender(<UnifiedDepositInterface />);
  await screen.findByLabelText("Amount (USD)");
  await act(async () => { finishHistory({ deposits: [{ id: "private-deposit", status: "completed", amountUsd: "123.45", txHash: TX, depositAddress: RECEIVER, createdAt: "2026-01-01T00:00:00Z", completedAt: "2026-01-01T00:01:00Z" }] }); });
  expect(screen.queryByText(/123.45/)).toBeNull();
 });

 it("keeps a late broadcast recoverable for its owner without requesting a proof from the new account", async () => {
  let finishTransfer!: (value: { txHash: string }) => void;
  mocks.send.mockReturnValueOnce(new Promise(resolve => { finishTransfer = resolve; }));
  const view = await pay();
  await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
  mocks.userId = "another-user";
  view.rerender(<UnifiedDepositInterface />);
  await act(async () => { finishTransfer({ txHash: TX }); });
  expect(readPendingDeposit("deposit-test-user")).toMatchObject({ txHash: TX });
  expect(readPendingDeposit("another-user")).toBeNull();
  expect(mocks.sign).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Retry registration" })).toBeNull();
 });

 it("does not register a proof after its initiating account changes", async () => {
  let finishProof!: (value: string) => void;
  mocks.sign.mockReturnValueOnce(new Promise(resolve => { finishProof = resolve; }));
  const view = await pay();
  await waitFor(() => expect(mocks.sign).toHaveBeenCalledOnce());
  mocks.userId = "another-user";
  view.rerender(<UnifiedDepositInterface />);
  await act(async () => { finishProof("0xproof"); });
  expect(mocks.request.mock.calls.filter(([path, options]) => path === "/v1/deposit/usdc" && options?.method === "POST")).toHaveLength(0);
  expect(readPendingDeposit("deposit-test-user")).toMatchObject({ txHash: TX });
 });

 it("blocks a duplicate transfer after remount and shows a late broadcast immediately for its original owner", async () => {
  let finishTransfer!: (value: { txHash: string }) => void;
  mocks.send.mockReturnValueOnce(new Promise(resolve => { finishTransfer = resolve; }));
  const view = await pay(true);
  await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
  mocks.userId = "another-user";
  view.rerender(<UnifiedDepositInterface />);
  await screen.findByLabelText("Amount (USD)");
  mocks.userId = "deposit-test-user";
  view.rerender(<UnifiedDepositInterface />);
  await screen.findByText("Waiting for your existing wallet deposit request…");
  expect(screen.queryByLabelText("Amount (USD)")).toBeNull();
  await act(async () => { finishTransfer({ txHash: TX }); });
  expect(await screen.findByRole("button", { name: "Retry registration" })).toBeEnabled();
  expect(screen.getByRole("link", { name: /view transfer/i })).toHaveAttribute("href", `https://basescan.io/tx/${TX}`);
  expect(mocks.send).toHaveBeenCalledOnce();
  expect(mocks.sign).not.toHaveBeenCalled();
 });

 it("recovers a late broadcast for a remounted owner when session storage refuses the write", async () => {
  let finishTransfer!: (value: { txHash: string }) => void;
  mocks.send.mockReturnValueOnce(new Promise(resolve => { finishTransfer = resolve; }));
  const view = await pay(true);
  await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
  mocks.userId = "another-user";
  view.rerender(<UnifiedDepositInterface />);
  await screen.findByLabelText("Amount (USD)");
  mocks.userId = "deposit-test-user";
  view.rerender(<UnifiedDepositInterface />);
  await screen.findByText("Waiting for your existing wallet deposit request…");
  const storage = sessionStorage;
  const write = vi.fn(() => { throw new DOMException("Storage quota exhausted", "QuotaExceededError"); });
  vi.stubGlobal("sessionStorage", { getItem: storage.getItem.bind(storage), removeItem: storage.removeItem.bind(storage), setItem: write });
  try {
   await act(async () => { finishTransfer({ txHash: TX }); });
   expect(await screen.findByRole("button", { name: "Retry registration" })).toBeEnabled();
   expect(screen.getByRole("link", { name: /view transfer/i })).toHaveAttribute("href", `https://basescan.io/tx/${TX}`);
   expect(readPendingDeposit("another-user")).toBeNull();
   expect(mocks.send).toHaveBeenCalledOnce();
   expect(mocks.sign).not.toHaveBeenCalled();
   expect(write).toHaveBeenCalledOnce();
  } finally {
   vi.stubGlobal("sessionStorage", storage);
   act(() => savePendingDeposit("deposit-test-user", null));
  }
  expect(readPendingDeposit("deposit-test-user")).toBeNull();
 });
});
