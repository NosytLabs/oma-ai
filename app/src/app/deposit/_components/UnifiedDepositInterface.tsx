"use client";

/**
 * USDC deposit interface — manual flow.
 *
 *   1. GET /v1/deposit/usdc returns the deposit address, USDC contract,
 *      network, and min/max bounds.
 *   2. User copies the address, sends USDC on Base from any wallet,
 *      and pastes the tx hash + amount below.
 *   3. POST /v1/deposit/usdc records a `pending` deposit. A background
 *      watcher credits the balance after on-chain confirmation.
 *
 * No wagmi / viem / SIWE — keeps the surface tiny and works for any
 * wallet (MetaMask, Rabby, Rainbow, Coinbase, even an exchange
 * withdrawal).
 */

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import {
	AlertTriangle,
	CheckCircle2,
	Clipboard,
	ExternalLink,
	Loader2,
	ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/hooks/useAuth";
import { request } from "@/lib/api";

interface DepositInstructions {
	depositAddress: string;
	network: string;
	chainId: number;
	usdcContract: string;
	memo: string;
	memoNote?: string;
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
	const [txHash, setTxHash] = useState("");
	const [error, setError] = useState("");
	const [processingStep, setProcessingStep] = useState("");
	const [recent, setRecent] = useState<UserDeposit[]>([]);
	const [loadingInstructions, setLoadingInstructions] = useState(true);
	const toast = useToast();
	const id = useId();
	const { isAuthenticated } = useAuth();

	const fetchInstructions = useCallback(async () => {
		setLoadingInstructions(true);
		try {
			const data = await requestDepositInstructions();
			setInstructions(data);
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "Failed to load deposit instructions";
			setError(msg);
		} finally {
			setLoadingInstructions(false);
		}
	}, []);

	const fetchRecent = useCallback(async () => {
		try {
			const data = await requestDepositStatus();
			setRecent(data.deposits);
		} catch {
			/* non-fatal */
		}
	}, []);

	useEffect(() => {
		if (isAuthenticated) {
			void fetchInstructions();
			void fetchRecent();
		}
	}, [isAuthenticated, fetchInstructions, fetchRecent]);

	const handleAmountChange = (value: string) => {
		if (value === "" || /^\d*\.?\d*$/.test(value)) setAmountUsd(value);
	};

	const handleCopy = useCallback(
		async (text: string, label: string) => {
			try {
				await navigator.clipboard.writeText(text);
				toast.success(`${label} copied`);
			} catch {
				toast.error("Could not copy — select the text manually");
			}
		},
		[toast],
	);

	const handleSubmit = useCallback(async () => {
		setError("");
		const amount = parseFloat(amountUsd);
		if (!amount || amount <= 0) {
			setError("Enter the deposit amount in USD");
			return;
		}
		if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
			setError("Tx hash must be a 0x… 64-character Base transaction hash");
			return;
		}
		setStep("processing");
		setProcessingStep("Submitting deposit for verification…");
		try {
			const result = await submitDeposit({ amountUsd: amount, txHash });
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
			setError(errMsg);
			toast.error(errMsg);
			setStep("error");
		}
	}, [amountUsd, txHash, toast, onDeposit, fetchRecent]);

	const handleReset = () => {
		setStep("select");
		setAmountUsd("");
		setTxHash("");
		setError("");
		setProcessingStep("");
	};

	if (!isAuthenticated) {
		return (
			<div className="rounded-lg border border-border-bright bg-panel p-6 text-center">
				<ShieldCheck className="mx-auto h-8 w-8 text-accent" />
				<h3 className="mt-3 text-base font-semibold text-text-bright">
					Sign in to deposit
				</h3>
				<p className="mt-1 text-sm text-text-secondary">
					You need an account to credit a deposit.
				</p>
				<a
					href="/login?next=/deposit"
					className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-accent bg-accent px-4 text-sm font-semibold text-void transition-colors hover:bg-accent-bright"
				>
					Sign in →
				</a>
			</div>
		);
	}

	const STEPS = [
		{ key: "select" as const, label: "Send USDC" },
		{ key: "processing" as const, label: "Verify" },
		{ key: "complete" as const, label: "Done" },
	];
	const currentStepIdx = STEPS.findIndex((s) => s.key === step);

	return (
		<div className="space-y-6">
			<nav
				aria-label="Deposit progress"
				className="flex items-start justify-center gap-0 px-2"
			>
				{STEPS.map((s, i) => (
					<div key={s.key} className="flex items-start min-w-0">
						<div
							className="flex w-24 shrink-0 flex-col items-center gap-1.5"
							aria-current={i === currentStepIdx ? "step" : undefined}
						>
							<div
								className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-mono font-semibold transition-colors duration-300 ${
									i === currentStepIdx
										? "border-accent bg-accent/10 text-accent"
										: i < currentStepIdx
											? "border-success/40 bg-success/10 text-success"
											: "border-border-bright bg-surface text-text-muted"
								}`}
							>
								{i + 1}
							</div>
							<span
								className={`text-center text-[10px] font-mono uppercase tracking-wider leading-tight ${
									i === currentStepIdx
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
								className={`mt-4 h-px w-6 shrink-0 ${
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
					className="rounded-lg border border-border-bright bg-panel p-6"
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
									instructions…
								</div>
							) : !instructions ? (
								<div className="rounded border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
									<AlertTriangle className="mr-2 inline h-4 w-4" />
									{error ||
										"Deposit receiver address is not configured. Set USDC_DEPOSIT_ADDRESS in the server env."}
								</div>
							) : (
								<>
									<div className="rounded-lg border border-accent/20 bg-accent/5 p-4">
										<div className="mb-2 flex items-center justify-between">
											<h3 className="text-sm font-semibold text-text-bright">
												Send USDC to this address
											</h3>
											<span className="rounded bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
												{instructions.network}
											</span>
										</div>
										<button
											type="button"
											onClick={() =>
												void handleCopy(
													instructions.depositAddress,
													"Deposit address",
												)
											}
											className="group flex w-full items-center justify-between gap-2 rounded border border-border bg-void px-3 py-2 font-mono text-sm text-text-bright transition-colors hover:border-accent/40"
											aria-label="Copy deposit address"
										>
											<span className="truncate">
												{shortAddr(instructions.depositAddress)}
											</span>
											<Clipboard
												className="h-4 w-4 shrink-0 text-text-muted group-hover:text-accent"
												aria-hidden="true"
											/>
										</button>
										<div className="mt-3 grid grid-cols-1 gap-1 text-[11px] text-text-muted sm:grid-cols-2">
											<div className="flex items-center justify-between gap-2">
												<span>USDC contract</span>
												<button
													type="button"
													onClick={() =>
														void handleCopy(
															instructions.usdcContract,
															"USDC contract",
														)
													}
													className="font-mono text-text-secondary hover:text-accent"
												>
													{shortAddr(instructions.usdcContract)}
												</button>
											</div>
											<div className="flex items-center justify-between gap-2">
												<span>Memo</span>
												<button
													type="button"
													onClick={() =>
														void handleCopy(instructions.memo, "Memo")
													}
													className="font-mono text-text-secondary hover:text-accent"
												>
													{instructions.memo}
												</button>
											</div>
										</div>
										{instructions.memoNote && (
											<p className="mt-3 text-[11px] leading-relaxed text-text-muted">
												{instructions.memoNote}
											</p>
										)}
										<p className="mt-2 text-[11px] text-text-muted">
											Min ${(instructions.minDepositCents / 100).toFixed(2)} ·
											Max ${(instructions.maxDepositCents / 100).toFixed(2)} · 1 USDC ={" "}
											{instructions.creditsPerCent * 100} credits
										</p>
									</div>

									<div>
										<label
											htmlFor={`${id}-amount`}
											className="mb-2 block text-xs font-medium uppercase tracking-wider text-text-secondary"
										>
											Amount you sent (USD)
										</label>
										<input
											id={`${id}-amount`}
											type="text"
											inputMode="decimal"
											placeholder="25.00"
											value={amountUsd}
											onChange={(e) => handleAmountChange(e.target.value)}
											className="w-full text-xl font-semibold bg-surface border border-border-bright rounded-lg px-4 py-3 placeholder:text-text-muted focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
										/>
									</div>

									<div>
										<label
											htmlFor={`${id}-tx`}
											className="mb-2 block text-xs font-medium uppercase tracking-wider text-text-secondary"
										>
											Transaction hash
										</label>
										<input
											id={`${id}-tx`}
											type="text"
											placeholder="0x…"
											value={txHash}
											onChange={(e) => setTxHash(e.target.value.trim())}
											className="w-full font-mono text-sm bg-surface border border-border-bright rounded-lg px-4 py-3 placeholder:text-text-muted focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
										/>
										<p className="mt-2 text-[11px] text-text-muted">
											Find this on{" "}
											<a
												href={`https://basescan.io/address/${instructions.depositAddress}`}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center gap-1 text-accent hover:underline"
											>
												Basescan
												<ExternalLink className="h-3 w-3" />
											</a>
											.
										</p>
									</div>

									<button
										type="button"
										onClick={() => void handleSubmit()}
										disabled={!amountUsd || !txHash}
										className="w-full py-4 text-sm font-semibold rounded-full bg-accent text-void hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
									>
										Submit deposit for verification
									</button>

									{recent.length > 0 && (
										<div className="border-t border-border pt-4">
											<h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
												Recent deposits
											</h4>
											<ul className="space-y-2">
												{recent.slice(0, 3).map((d) => (
													<li
														key={d.id}
														className="flex items-center justify-between gap-2 text-xs"
													>
														<div className="flex items-center gap-2 text-text-secondary">
															<span
																className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
																	d.status === "completed"
																		? "bg-success/10 text-success"
																		: d.status === "pending"
																			? "bg-warning/10 text-warning"
																			: "bg-error/10 text-error"
																}`}
															>
																{d.status}
															</span>
															<span>${d.amountUsd} USDC</span>
															{d.txHash && (
																<a
																	href={`https://basescan.io/tx/${d.txHash}`}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="font-mono text-accent hover:underline"
																>
																	{shortTx(d.txHash)}
																</a>
															)}
														</div>
														<span className="text-text-muted">
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
								Your balance will update automatically once the watcher
								confirms the on-chain transfer (typically &lt; 60 s on Base).
							</p>
							<button
								type="button"
								onClick={handleReset}
								className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-accent bg-accent px-4 text-sm font-semibold text-void transition-colors hover:bg-accent-bright"
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
							<button
								type="button"
								onClick={handleReset}
								className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent"
							>
								Try again
							</button>
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
		body: JSON.stringify({ amountUsd: args.amountUsd, txHash: args.txHash, network: "base" }),
	});
}