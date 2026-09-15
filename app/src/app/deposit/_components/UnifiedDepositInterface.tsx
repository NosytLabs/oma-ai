"use client";

/**
	* USDC deposit interface — connect your wallet and pay in-app.
	*
	* 1. GET /v1/deposit/usdc returns the treasury deposit address, USDC
	*    contract, network, and min/max bounds.
	* 2. User connects their wallet (MetaMask, Rabby, Rainbow, Coinbase…),
	*    enters an amount, and clicks "Send". The USDC `transfer()` is built
	*    here and confirmed in the user's wallet popup.
	* 3. POST /v1/deposit/usdc records a `pending` deposit (txHash +
	*    fromAddress). A background watcher credits the balance after
	*    on-chain confirmation, verifying the sender address matches.
	*
	* No copy-paste, no memo, no manual tx-hash entry.
	*/

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import {
	AlertTriangle,
	CheckCircle2,
	ExternalLink,
	Loader2,
	ShieldCheck,
	Wallet,
} from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/hooks/useAuth";
import { request } from "@/lib/api";
import { isAuthError } from "@/lib/api/client";
import {
	connectWallet,
	ensureBaseChain,
	getConnectedAccount,
	hasWallet,
	sendUsdcTransfer,
} from "@/lib/wallet";

interface DepositInstructions {
	depositAddress: string;
	network: string;
	chainId: number;
	usdcContract: string;
	minDepositCents: number;
	maxDepositCents: number;
	creditsPerCent: number;
}

interface UserDeposit {
	id: string;
	status: "pending" | "settling" | "completed" | "failed" | "refunded" | "expired";
	amountUsd: string;
	txHash: string | null;
	depositAddress: string | null;
	createdAt: string;
	completedAt: string | null;
}

export interface PendingDeposit {
	id: string;
	status: UserDeposit["status"];
	amountCents: string;
	createdAt: string;
}

type BroadcastDeposit = {
	amountUsd: number;
	txHash: string;
	fromAddress: `0x${string}`;
};

function shortAddr(a: string): string {
	if (a.length <= 12) return a;
	return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function shortTx(t: string): string {
	if (t.length <= 14) return t;
	return `${t.slice(0, 10)}…${t.slice(-6)}`;
}

export function UnifiedDepositInterface({
	onDeposit,
}: {
	onDeposit?: (d: PendingDeposit) => void;
}) {
	const [step, setStep] = useState<"select" | "processing" | "complete" | "error">(
		"select",
	);
	const [instructions, setInstructions] = useState<DepositInstructions | null>(null);
	const [amountUsd, setAmountUsd] = useState("");
	const [error, setError] = useState("");
	const [processingStep, setProcessingStep] = useState("");
	const [recent, setRecent] = useState<UserDeposit[]>([]);
	const [loadingInstructions, setLoadingInstructions] = useState(true);
	const [connectedAddress, setConnectedAddress] = useState<`0x${string}` | null>(null);
	const [connecting, setConnecting] = useState(false);
	const [broadcastDeposit, setBroadcastDeposit] = useState<BroadcastDeposit | null>(null);
	const toast = useToast();
	const id = useId();
	const { isAuthenticated, isDemo } = useAuth();

	const fetchInstructions = useCallback(async () => {
		setLoadingInstructions(true);
		try {
			const data = await requestDepositInstructions();
			setInstructions(data);
		} catch (err) {
			// Demo sessions hit the backend with a cookie the deposit route
			// rejects (sessionOrBearerAuth requires a real Better-Auth token,
			// not the public-preview cookie). Hide the raw "[401] ..." text
			// from guests — they'd never be able to resolve it themselves.
			if (isDemo || isAuthError(err)) {
				setError("");
			} else {
				const msg =
					err instanceof Error ? err.message : "Failed to load deposit instructions";
				setError(msg);
			}
		} finally {
			setLoadingInstructions(false);
		}
	}, [isDemo]);

	const fetchRecent = useCallback(async () => {
		try {
			const data = await requestDepositStatus();
			setRecent(data.deposits);
		} catch {
			// Guest/demo sessions can't reach this endpoint — swallow quietly.
		}
	}, []);

	useEffect(() => {
		// Treat demo sessions as unauthenticated for deposit: the backend
		// routes use sessionOrBearerAuth which rejects the demo cookie, so
		// trying to load would just flash a confusing 401.
		if (isAuthenticated && !isDemo) {
			void fetchInstructions();
			void fetchRecent();
		}
	}, [isAuthenticated, isDemo, fetchInstructions, fetchRecent]);

	// Prefill the already-authorized account without popping the wallet.
	useEffect(() => {
		if (!isAuthenticated || isDemo) return;
		let cancelled = false;
		void getConnectedAccount().then((addr) => {
			if (!cancelled && addr) setConnectedAddress(addr);
		});
		return () => {
			cancelled = true;
		};
	}, [isAuthenticated, isDemo]);

	const handleAmountChange = (value: string) => {
		if (value === "" || /^\d*\.?\d*$/.test(value)) setAmountUsd(value);
	};

	const handleConnect = useCallback(async () => {
		setConnecting(true);
		setError("");
		try {
			const wallet = await connectWallet();
			await ensureBaseChain();
			setConnectedAddress(wallet.address);
			toast.success("Wallet connected");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Wallet connection failed");
		} finally {
			setConnecting(false);
		}
	}, [toast]);

	const handlePay = useCallback(async () => {
		setError("");
		const amount = parseFloat(amountUsd);
		if (!amount || amount <= 0) {
			setError("Enter the deposit amount in USD");
			return;
		}
		if (!instructions) {
			setError("Deposit details are still loading — try again in a moment.");
			return;
		}
		const minCents = instructions.minDepositCents;
		const maxCents = instructions.maxDepositCents;
		if (Math.round(amount * 100) < minCents) {
			setError(`Minimum deposit is $${(minCents / 100).toFixed(2)}`);
			return;
		}
		if (Math.round(amount * 100) > maxCents) {
			setError(`Maximum deposit is $${(maxCents / 100).toFixed(2)}`);
			return;
		}
		if (!connectedAddress) {
			setError("Connect your wallet first");
			return;
		}

		setStep("processing");
		setProcessingStep("Confirm the USDC transfer in your wallet…");
		let txSent = false;
		try {
			const { txHash } = await sendUsdcTransfer({
				to: instructions.depositAddress as `0x${string}`,
				amountUsd: amount,
				from: connectedAddress,
			});
			txSent = true;
			const pendingDeposit = { amountUsd: amount, txHash, fromAddress: connectedAddress };
			setBroadcastDeposit(pendingDeposit);

			setProcessingStep("Submitting deposit for verification…");
			const result = await submitDeposit(pendingDeposit);
			setBroadcastDeposit(null);
			toast.success(
				`Deposit recorded. ${result.status === "pending" ? "Awaiting on-chain confirmation." : ""}`,
			);
			onDeposit?.({
				id: result.depositId,
				status: result.status,
				amountCents: String(result.amountCents),
				createdAt: new Date().toISOString(),
			});
			void fetchRecent();
			setStep("complete");
		} catch (e) {
			const errMsg = e instanceof Error ? e.message : "Deposit failed";
			// Distinguish a wallet popup rejection (nothing left the account)
			// from a submission failure after the tx was already broadcast.
			if (!txSent && /rejected|denied|user refused/i.test(errMsg)) {
				toast.error("Transfer rejected in your wallet");
				setStep("select");
				setError("The transfer was rejected in your wallet. No funds left your account.");
			} else {
				setError(
					txSent
						? "Your USDC transfer was broadcast, but we could not register it yet. Retry registration below; do not send another transfer."
						: errMsg,
				);
				toast.error(errMsg);
				setStep("error");
			}
		}
	}, [amountUsd, instructions, connectedAddress, toast, onDeposit, fetchRecent]);

	const handleRetryRegistration = useCallback(async () => {
		if (!broadcastDeposit) return;
		setError("");
		setStep("processing");
		setProcessingStep("Retrying deposit registration…");
		try {
			const result = await submitDeposit(broadcastDeposit);
			setBroadcastDeposit(null);
			toast.success(
				`Deposit recorded. ${result.status === "pending" ? "Awaiting on-chain confirmation." : ""}`,
			);
			onDeposit?.({
				id: result.depositId,
				status: result.status,
				amountCents: String(result.amountCents),
				createdAt: new Date().toISOString(),
			});
			void fetchRecent();
			setStep("complete");
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "We still could not register this transfer. Please try again in a moment.",
			);
			setStep("error");
		}
	}, [broadcastDeposit, fetchRecent, onDeposit, toast]);

	const handleReset = () => {
		setStep("select");
		setAmountUsd("");
		setError("");
		setProcessingStep("");
		setBroadcastDeposit(null);
	};

	if (!isAuthenticated || isDemo) {
		return (
			<div className="rounded-[var(--radius-lg)] border border-border-bright bg-panel p-6 text-center">
				<ShieldCheck className="mx-auto h-8 w-8 text-accent" />
				<h2 className="mt-3 text-base font-semibold text-text-bright">
					Sign in to deposit
				</h2>
				<p className="mt-1 text-sm text-text-secondary">
					You need an account to credit a deposit.
				</p>
				<a
					href="/login?next=/deposit"
					className="btn-mono btn-primary mt-4"
				>
					Sign in
				</a>
			</div>
		);
	}

	const STEPS = [
		{ key: "select" as const, label: "Pay with wallet" },
		{ key: "processing" as const, label: "Verify" },
		{ key: "complete" as const, label: "Done" },
	];
	const currentStepIdx = step === "error"
		? Math.max(0, STEPS.findIndex((s) => s.key === "processing"))
		: STEPS.findIndex((s) => s.key === step);

	return (
		<div className="space-y-6">
			<nav
				aria-label="Deposit progress"
				className="flex w-full items-start justify-center gap-0 px-0 sm:px-2"
			>
				{STEPS.map((s, i) => (
					<div key={s.key} className="flex min-w-0 flex-1 items-start sm:flex-none">
						<div
							className="flex w-full min-w-0 flex-col items-center gap-1.5 sm:w-24 sm:shrink-0"
							aria-current={i === currentStepIdx ? "step" : undefined}
						>
							<div
									className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-mono font-semibold transition-colors duration-300 ${
									step === "error" && i === currentStepIdx
										? "border-error bg-error/10 text-error"
										: i === currentStepIdx
										? "border-accent bg-accent/10 text-accent"
										: i < currentStepIdx
											? "border-success/40 bg-success/10 text-success"
											: "border-border-bright bg-surface text-text-muted"
								}`}
							>
								{i + 1}
							</div>
							<span
									className={`max-w-full px-0.5 text-center text-[9px] font-mono uppercase tracking-wider leading-tight sm:text-[10px] ${
									step === "error" && i === currentStepIdx
										? "text-error"
										: i === currentStepIdx
										? "text-accent"
										: i < currentStepIdx
											? "text-success"
											: "text-text-muted"
								}`}
							>
								{s.label}
							</span>
						</div>
						{i < STEPS.length - 1 && (
							<div
								aria-hidden="true"
								className={`mt-4 h-px min-w-3 flex-1 sm:w-6 sm:flex-none sm:min-w-0 ${
									i < currentStepIdx ? "bg-success/40" : "bg-border-bright"
								}`}
							/>
						)}
					</div>
				))}
			</nav>

			<AnimatePresence mode="wait">
				<m.div
					key={step}
					className="rounded-[var(--radius-lg)] border border-border-bright bg-panel p-6"
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -8 }}
					transition={{ duration: 0.2 }}
				>
					{step === "select" && (
						<div className="space-y-5">
							{loadingInstructions && !instructions ? (
								<div className="flex items-center gap-3 py-6 text-text-muted">
									<Loader2 className="h-4 w-4 animate-spin" /> Loading deposit
									details…
								</div>
							) : !instructions ? (
								<div className="rounded-[var(--radius-sm)] border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
									<AlertTriangle className="mr-2 inline h-4 w-4" />
									{error ||
										"Deposit receiver address is not configured. Set USDC_DEPOSIT_ADDRESS in the server env."}
								</div>
							) : (
								<>
									{!connectedAddress && (
										<button
											type="button"
											onClick={() => void handleConnect()}
											disabled={connecting}
											className="btn-primary flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
										>
											{connecting ? (
												<>
													<Loader2 className="h-4 w-4 animate-spin" />
													Connecting…
												</>
											) : (
												<>
													<Wallet className="h-4 w-4" aria-hidden="true" />
													Connect wallet to pay
												</>
											)}
										</button>
									)}

									{connectedAddress && (
										<div className="flex items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-success/25 bg-success/5 px-4 py-3">
											<div className="min-w-0">
												<div className="text-xs font-medium uppercase tracking-wider text-text-secondary">
													Paying from
												</div>
												<button
													type="button"
													onClick={() => void handleConnect()}
													className="mt-0.5 font-mono text-sm text-text-bright tabular-nums hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
													title="Switch wallet account"
												>
													{shortAddr(connectedAddress)}
												</button>
											</div>
											<span className="shrink-0 rounded-[var(--radius-sm)] bg-success/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-success">
												Base
											</span>
										</div>
									)}

									{!hasWallet() && (
										<div className="rounded-[var(--radius-sm)] border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
											<AlertTriangle className="mr-2 inline h-4 w-4" />
											No wallet detected. Install MetaMask, Rabby, or Coinbase
											Wallet to pay with USDC — or use the Card tab.
										</div>
									)}

									<div>
										<label
											htmlFor={`${id}-amount`}
											className="mb-2 block text-xs font-medium uppercase tracking-wider text-text-secondary"
										>
											Amount (USD)
										</label>
										<input
											id={`${id}-amount`}
											type="text"
											inputMode="decimal"
											placeholder="25.00"
											value={amountUsd}
											onChange={(e) => handleAmountChange(e.target.value)}
											className="w-full text-xl font-semibold bg-surface border border-border-bright rounded-[var(--radius-lg)] px-4 py-3 placeholder:text-text-muted focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent tabular-nums"
										/>
										<p className="mt-2 text-[11px] text-text-muted tabular-nums">
											Min ${(instructions.minDepositCents / 100).toFixed(2)} ·
											Max ${(instructions.maxDepositCents / 100).toFixed(2)} · 1 USDC ={" "}
											{instructions.creditsPerCent * 100} credits
										</p>
									</div>

									<p className="flex items-start gap-2 text-[11px] leading-relaxed text-text-muted">
										<ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
										<span>
											Your payment is sent directly from your wallet to the OMA
											treasury on Base{" "}
											<a
												href={`https://basescan.io/address/${instructions.depositAddress}`}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center gap-1 font-mono text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent tabular-nums"
											>
												{shortAddr(instructions.depositAddress)}
												<ExternalLink className="h-3 w-3" />
											</a>
											. Credits post automatically once the transfer confirms
											(typically &lt; 60 s). No memo needed.
										</span>
									</p>

									{error && (
										<div
											role="alert"
											className="rounded-[var(--radius-sm)] border border-error/30 bg-error/10 p-3 text-sm text-error"
										>
											{error}
										</div>
									)}

									{connectedAddress && (
										<button
											type="button"
											onClick={() => void handlePay()}
											disabled={!connectedAddress || !amountUsd || !instructions}
											className="btn-primary w-full py-4 text-sm rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
										>
											{connectedAddress
												? `Send ${amountUsd || "0"} USDC`
												: "Connect wallet to pay"}
										</button>
									)}

									{recent.length > 0 && (
										<div className="border-t border-border pt-4">
											<h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
												Recent deposits
											</h4>
											<ul className="space-y-2">
												{recent.slice(0, 3).map((d) => (
													<li
														key={d.id}
														className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-2"
													>
														<div className="flex min-w-0 flex-wrap items-center gap-2 text-text-secondary">
															<span
																className={`inline-flex rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
																	d.status === "completed"
																		? "bg-success/10 text-success"
																		: d.status === "pending"
																			? "bg-warning/10 text-warning"
																			: "bg-error/10 text-error"
																}`}
															>
																{d.status}
															</span>
															<span className="tabular-nums">${d.amountUsd} USDC</span>
															{d.txHash && (
																<a
																	href={`https://basescan.io/tx/${d.txHash}`}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="font-mono text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent tabular-nums"
																>
																	{shortTx(d.txHash)}
																</a>
															)}
														</div>
														<span className="text-text-muted tabular-nums">
															{new Date(d.createdAt).toLocaleDateString()}
														</span>
													</li>
												))}
											</ul>
										</div>
									)}
								</>
							)}
						</div>
					)}

					{step === "processing" && (
						<div className="py-6 text-center">
							<Loader2 className="mx-auto h-10 w-10 animate-spin text-accent" />
							<p className="mt-3 text-sm text-text-secondary">
								{processingStep || "Submitting…"}
							</p>
						</div>
					)}

					{step === "complete" && (
						<div className="py-6 text-center">
							<CheckCircle2 className="mx-auto h-10 w-10 text-success" />
							<h3 className="mt-3 text-lg font-bold text-text-bright">
								Deposit recorded
							</h3>
							<p className="mt-1 text-sm text-text-secondary">
								Your credit balance will update automatically once the watcher
								confirms the on-chain transfer (typically &lt; 60 s on Base).
							</p>
							<button
								type="button"
								onClick={handleReset}
								className="mt-4 inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-accent bg-accent px-4 text-sm font-semibold text-void transition-colors duration-200 ease-out hover:bg-accent-bright active:scale-[0.97]"
							>
								Deposit again
							</button>
						</div>
					)}

					{step === "error" && (
						<div className="py-6 text-center">
							<AlertTriangle className="mx-auto h-10 w-10 text-red" />
							<h3 className="mt-3 text-lg font-bold text-text-bright">
								Deposit submission failed
							</h3>
							<p className="mt-1 text-sm text-text-secondary">{error}</p>
							<div className="mt-4 flex flex-wrap justify-center gap-2">
								{broadcastDeposit ? (
									<button
										type="button"
										onClick={() => void handleRetryRegistration()}
										className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-accent bg-accent px-4 text-sm font-semibold text-void transition-colors duration-200 ease-out hover:bg-accent-bright active:scale-[0.97]"
									>
										Retry registration
									</button>
								) : null}
								<button
									type="button"
									onClick={handleReset}
									className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface px-4 text-sm font-medium text-text-secondary transition-colors duration-200 ease-out hover:border-accent hover:text-accent active:scale-[0.97]"
								>
									{broadcastDeposit ? "Start over" : "Try again"}
								</button>
							</div>
						</div>
					)}
				</m.div>
			</AnimatePresence>
		</div>
	);
}

async function requestDepositInstructions(): Promise<DepositInstructions> {
	return request<DepositInstructions>("/v1/deposit/usdc");
}

async function requestDepositStatus(): Promise<{ deposits: UserDeposit[] }> {
	return request<{ deposits: UserDeposit[] }>("/v1/deposit/status");
}

async function submitDeposit(args: {
	amountUsd: number;
	txHash: string;
	fromAddress: `0x${string}`;
}): Promise<{
	depositId: string;
	status: UserDeposit["status"];
	amountCents: number;
	txHash: string;
	network: string;
	message: string;
}> {
	return request("/v1/deposit/usdc", {
		method: "POST",
		body: JSON.stringify({
			amountUsd: args.amountUsd,
			txHash: args.txHash,
			fromAddress: args.fromAddress,
			network: "base",
		}),
	});
}
