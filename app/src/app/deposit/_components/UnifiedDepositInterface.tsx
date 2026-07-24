"use client";

import { AnimatePresence, m } from "framer-motion";
import {
	AlertTriangle,
	Check,
	CheckCircle2,
	ExternalLink,
	Loader2,
	ShieldCheck,
} from "lucide-react";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { parseUnits } from "viem";
import { useConnection, usePublicClient, useWriteContract } from "wagmi";
import { CryptoLogo } from "@/components/ui/CryptoLogo";
import { useToast } from "@/components/ui/Toast";
import { api, type DepositStatus, getAuthToken } from "@/lib/api";
import { Magnetic, scaleInSpring } from "@/lib/motion";
import { calculateUsdValue, useCryptoPrices } from "@/lib/crypto-prices";
import { formatCents } from "@/lib/utils";
import {
	type CoinOption,
	type DepositStep,
	ERC20_ABI,
	ROUTES,
	type RouteInfo,
	treasuryAddress,
	USDC_ADDRESS,
} from "../_constants";
import { CoinSelector } from "./CoinSelector";

export interface PendingDeposit {
	id: string;
	status: DepositStatus["status"];
	amountCents: string;
	coin: string;
	createdAt: string;
}

export function UnifiedDepositInterface({
	onDeposit,
}: {
	onDeposit?: (d: PendingDeposit) => void;
}) {
	const [step, setStep] = useState<DepositStep>("select");
	const [selectedCoin, setSelectedCoin] = useState<CoinOption | null>(null);
	// Prefill from ?amount= when users arrive from dashboard/credits "Buy".
	const [amount, setAmount] = useState(() => {
		if (typeof window === "undefined") return "";
		const raw = new URLSearchParams(window.location.search).get("amount");
		if (!raw) return "";
		return /^\d*\.?\d*$/.test(raw) && parseFloat(raw) > 0 ? raw : "";
	});
	const [processingStep, setProcessingStep] = useState("");
	const [txHash, setTxHash] = useState("");
	const [error, setError] = useState("");
	const [coinBalance, setCoinBalance] = useState<string | null>(null);
	const toast = useToast();
	const id = useId();

	const stepOrder = useMemo<DepositStep[]>(
		() => ["select", "processing", "complete", "error"],
		[],
	);
	const prevStepRef = useRef<DepositStep>("select");
	const [slideDirection, setSlideDirection] = useState(1);

	useEffect(() => {
		const prevIdx = stepOrder.indexOf(prevStepRef.current);
		const currIdx = stepOrder.indexOf(step);
		if (prevIdx !== -1 && currIdx !== -1 && prevIdx !== currIdx) {
			setSlideDirection(currIdx > prevIdx ? 1 : -1);
		}
		prevStepRef.current = step;
	}, [step, stepOrder]);

	const { writeContractAsync } = useWriteContract();
	const publicClient = usePublicClient();
	const { prices } = useCryptoPrices();
	const { address: walletAddress } = useConnection();

	const usdValue =
		selectedCoin && amount
			? calculateUsdValue(selectedCoin.symbol, parseFloat(amount) || 0, prices)
			: null;

	const detectRoute = useCallback((): RouteInfo => {
		if (!selectedCoin) return ROUTES["usdc-base"];
		return ROUTES[selectedCoin.id] ?? ROUTES["usdc-base"];
	}, [selectedCoin]);

	const route = detectRoute();

	useEffect(() => {
		if (!selectedCoin) {
			setCoinBalance(null);
			return;
		}
		const fetchBalance = async () => {
			try {
				const bal = await api.balance.get();
				const balanceCents = parseInt(bal.balanceCents || "0", 10);
				setCoinBalance(formatCents(balanceCents));
			} catch {
				setCoinBalance(null);
			}
		};
		fetchBalance();
	}, [selectedCoin]);

	const handleAmountChange = (value: string) => {
		if (value === "" || /^\d*\.?\d*$/.test(value)) setAmount(value);
	};

	const handleStartDeposit = useCallback(async () => {
		if (!amount || parseFloat(amount) <= 0) return;
		setError("");

		if (!treasuryAddress) {
			const errMsg =
				"Treasury address not configured. Please set NEXT_PUBLIC_TREASURY_BASE_ADDRESS in your environment variables. Deposits are disabled until treasury is configured.";
			setError(errMsg);
			toast.error("Treasury misconfiguration detected");
			setStep("error");
			return;
		}

		setStep("processing");

		// B2 fix: session cookie is HttpOnly so `document.cookie` returns
		// null in production. `getAuthToken()` reads it via the `/api/csrf`
		// round-trip (or cache) and returns the JWT, falling back to "".
		const sessionToken = getAuthToken() ?? "";

		try {
			if (selectedCoin?.id === "usdc-base") {
				if (!publicClient) {
					throw new Error(
						"Wallet not connected. Please connect your wallet to continue.",
					);
				}
				const chainId = await publicClient.getChainId();

				const nonceResponse = await fetch("/api/v1/deposit/usdc/nonce", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${sessionToken}`,
					},
					body: JSON.stringify({
						amount: parseFloat(amount),
						walletAddress,
						chainId,
					}),
				});

				if (!nonceResponse.ok) {
					const errorData = await nonceResponse.json().catch(() => ({}));
					throw new Error(
						errorData.error?.message || "Failed to get deposit nonce",
					);
				}

				const { nonce } = await nonceResponse.json();

				setProcessingStep("Requesting wallet signature...");
				const parsedAmount = parseUnits(amount, 6);

				const tx = await writeContractAsync({
					address: USDC_ADDRESS,
					abi: ERC20_ABI,
					functionName: "transfer",
					args: [treasuryAddress as `0x${string}`, parsedAmount],
				});

				setProcessingStep("Transaction broadcasting...");
				setTxHash(tx);

				await publicClient.waitForTransactionReceipt({ hash: tx });

				setProcessingStep("Verifying deposit and crediting account...");

				const result = await fetch("/api/v1/deposit/usdc", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${sessionToken}`,
					},
					body: JSON.stringify({
						amount: parseFloat(amount),
						txHash: tx,
						nonce,
						walletAddress,
						chainId,
					}),
				}).then(async (res) => {
					if (!res.ok) {
						const errorData = await res.json().catch(() => ({}));
						throw new Error(errorData.error?.message || "Deposit failed");
					}
					return res.json();
				});

				onDeposit?.({
					id: result.depositId,
					status: "completed",
					amountCents: String(result.credits),
					coin: "USDC",
					createdAt: new Date().toISOString(),
				});
				toast.success(`Successfully deposited $${amount} USDC`);
				setStep("complete");
			} else {
				const errorMsg =
					"Only USDC on Base is supported for direct deposit. Please select USDC.";
				setError(errorMsg);
				toast.error(errorMsg);
				setStep("error");
			}
		} catch (e) {
			const errMsg = e instanceof Error ? e.message : "Deposit failed";
			setError(errMsg);
			toast.error(errMsg);
			setStep("error");
		}
		// treasuryAddress is a module-level constant (never changes), so including
		// it in deps is unnecessary but harmless for correctness — the linter
		// warns because it can't be a dependency that triggers re-renders.
	}, [
		amount,
		selectedCoin,
		publicClient,
		walletAddress,
		onDeposit,
		toast,
		writeContractAsync,
	]);

	const handleReset = () => {
		setStep("select");
		setSelectedCoin(null);
		setAmount("");
		setTxHash("");
		setProcessingStep("");
		setError("");
	};

	const quickAmounts = [10, 50, 100, 500];

	const STEPS = [
		{ key: "select" as const, label: "Select Asset" },
		{ key: "processing" as const, label: "Process" },
		{ key: "complete" as const, label: "Complete" },
	];

	const slideVariants = {
		enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
		center: { x: 0, opacity: 1 },
		exit: (dir: number) => ({
			x: dir * -40,
			opacity: 0,
			transition: { duration: 0.12 },
		}),
	};

	const currentStepIdx = STEPS.findIndex((s) => s.key === step);

	return (
		<div className="space-y-6">
			{step !== "error" && (
				<nav
					aria-label="Deposit progress"
					className="flex items-start justify-center gap-0 px-2"
				>
					{STEPS.map((s, i) => (
						<div key={s.key} className="flex items-start min-w-0">
							<div
								className="flex w-[5.5rem] sm:w-28 shrink-0 flex-col items-center gap-1.5"
								aria-current={i === currentStepIdx ? "step" : undefined}
							>
								<div
									className={`relative flex h-8 w-8 items-center justify-center rounded-full border text-xs font-mono font-semibold transition-colors duration-300 ${
										i === currentStepIdx
											? "border-accent bg-accent/10 text-accent"
											: i < currentStepIdx
												? "border-success/40 bg-success/10 text-success"
												: "border-border-bright bg-surface text-text-muted"
									}`}
								>
									{i < currentStepIdx ? <Check className="h-4 w-4" /> : i + 1}
									{i === currentStepIdx && (
										<m.div
											className="absolute inset-0 rounded-full border border-accent"
											layoutId="step-indicator"
											transition={{
												type: "spring",
												stiffness: 380,
												damping: 30,
											}}
										/>
									)}
								</div>
								<span
									className={`max-w-full text-center text-[10px] font-mono uppercase tracking-wider leading-tight px-0.5 ${
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
									className={`mt-4 h-px w-6 sm:w-10 shrink-0 ${
										i < currentStepIdx
											? "bg-success/40"
											: "bg-border-bright"
									}`}
								/>
							)}
						</div>
					))}
				</nav>
			)}

			<AnimatePresence mode="wait" custom={slideDirection}>
				<m.div
					key={step}
					className="rounded-lg border border-border-bright bg-panel p-6"
					custom={slideDirection}
					variants={slideVariants}
					initial="enter"
					animate="center"
					exit="exit"
					transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
				>
					{step === "select" && (
						<div className="space-y-5">
							<CoinSelector
								selected={selectedCoin}
								onSelect={setSelectedCoin}
							/>

							<div>
								<div className="flex items-center justify-between mb-2">
									<label
										htmlFor={id}
										className="text-xs font-medium uppercase tracking-wider text-text-secondary font-mono"
									>
										Amount
									</label>
									{selectedCoin && (
										<span className="text-xs text-text-muted font-mono">
											Balance: {coinBalance ?? "--"}
										</span>
									)}
								</div>
								<div className="relative glow-accent-sm">
									<input
										id={id}
										type="text"
										placeholder="0.00"
										value={amount}
										onChange={(e) => handleAmountChange(e.target.value)}
										className="w-full text-xl font-semibold bg-surface border border-border-bright rounded-lg px-4 py-4
                    placeholder:text-text-muted
                    focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20
                    hover:border-accent/30"
									/>
									{selectedCoin && (
										<div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
											<CryptoLogo symbol={selectedCoin.symbol} size={20} />
											<span className="text-sm font-semibold text-text-bright">
												{selectedCoin.symbol}
											</span>
										</div>
									)}
								</div>
								{usdValue !== null && selectedCoin && (
									<div className="mt-2 text-sm text-text-muted font-mono">
										≈ ${usdValue.toFixed(2)} USD
									</div>
								)}
							</div>

							{selectedCoin && (
								<div className="flex gap-2">
									{quickAmounts.map((q) => (
										<Magnetic key={q} strength={4}>
											<m.button
												onClick={() => setAmount(q.toString())}
												className="flex-1 rounded border border-border-bright py-2 text-sm font-medium
                        text-text-secondary bg-surface
                        hover:bg-surface-elevated hover:text-text-bright
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30
                        transition-colors duration-150"
												whileTap={{ scale: 0.97 }}
											>
												${q}
											</m.button>
										</Magnetic>
									))}
								</div>
							)}

							{selectedCoin && amount && parseFloat(amount) > 0 && (
								<m.div
									className="rounded border border-border-bright bg-surface/50 p-4 glass tilt-card sheen"
									initial={{ opacity: 0, height: 0 }}
									animate={{ opacity: 1, height: "auto" }}
									transition={{ duration: 0.2 }}
								>
									<div className="flex items-center justify-between mb-3">
										<span className="text-sm text-text-secondary font-medium">
											Route
										</span>
										{route.badge && (
											<span className="rounded px-2 py-0.5 text-xs font-mono font-semibold text-accent border border-accent/20 bg-accent/10">
												{route.badge}
											</span>
										)}
									</div>
									<div className="flex items-center gap-3">
										<div className="flex h-10 w-10 items-center justify-center rounded border border-border-bright bg-surface">
											<ShieldCheck className="h-5 w-5 text-accent" />
										</div>
										<div className="flex-1">
											<div className="font-semibold text-text-bright">
												{route.label}
											</div>
											<div className="text-xs text-text-secondary">
												{route.description}
											</div>
										</div>
										<div className="text-right">
											<div className="text-xs text-text-muted">Est. time</div>
											<div className="text-sm font-medium text-text-bright">
												{route.estimatedTime}
											</div>
										</div>
									</div>
								</m.div>
							)}

							<m.button
								onClick={handleStartDeposit}
								disabled={
									!selectedCoin ||
									!amount ||
									parseFloat(amount) <= 0 ||
									!treasuryAddress
								}
								className="w-full py-4 text-sm font-semibold rounded-full
                bg-accent text-void
                hover:bg-accent-bright
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
                disabled:opacity-40 disabled:cursor-not-allowed
                active:translate-y-0
                transition-colors duration-150"
								whileHover={{ scale: 1 }}
								whileTap={{ scale: 0.98 }}
							>
								{!treasuryAddress
									? "Treasury not configured"
									: !selectedCoin
										? "Select an asset to continue"
										: !amount || parseFloat(amount) <= 0
											? "Enter an amount"
											: "Continue"}
							</m.button>
						</div>
					)}

					{step === "processing" && (
						<m.div
							className="text-left py-6"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.2 }}
						>
								<div className="flex items-center justify-center mb-6">
									<div className="pulse-ring">
										<m.div
											className="h-14 w-14 rounded border border-border-bright bg-surface flex items-center justify-center"
											animate={{ rotate: 360 }}
											transition={{
												duration: 2,
												repeat: Infinity,
												ease: "linear",
											}}
										>
											<Loader2 className="h-7 w-7 text-accent" />
										</m.div>
									</div>
								</div>
								<h3 className="text-lg font-bold text-text-bright text-center mb-2">
									Processing Deposit
								</h3>
								<p className="text-text-secondary text-sm text-center mb-4">
									{processingStep}
								</p>
								{txHash && (
									<div className="flex items-center justify-center gap-2">
										<span className="text-xs text-text-muted font-mono">
											Tx:
										</span>
										<span className="text-xs font-mono text-accent">
											{txHash.slice(0, 10)}...{txHash.slice(-8)}
										</span>
										<a
											href={`https://basescan.io/tx/${txHash}`}
											target="_blank"
											rel="noopener"
											className="text-accent hover:text-accent-bright"
										>
											<ExternalLink className="h-3 w-3" />
										</a>
									</div>
								)}
						</m.div>
					)}

					{step === "complete" && (
						<m.div
							className="text-left py-6"
							variants={scaleInSpring}
							initial="hidden"
							animate="show"
							viewport={undefined}
						>
							<div className="flex items-center gap-3 mb-4">
								<div className="flex h-12 w-12 items-center justify-center rounded-full border border-success/30 bg-success/10">
									<CheckCircle2 className="h-6 w-6 text-success" />
								</div>
								<div>
									<h3 className="text-lg font-bold text-text-bright">
										Deposit Complete!
									</h3>
									<p className="text-text-secondary text-sm">
										Your credits have been added to your account.
									</p>
								</div>
							</div>
							<m.button
								onClick={handleReset}
								className="py-3 px-6 text-sm font-semibold rounded-lg
                bg-accent text-void
                hover:bg-accent-bright
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
                active:translate-y-0
                transition-colors duration-150"
								whileHover={{ scale: 1 }}
								whileTap={{ scale: 0.98 }}
							>
								Make Another Deposit
							</m.button>
						</m.div>
					)}

					{step === "error" && (
						<m.div
							className="text-left py-6"
							initial={{ opacity: 0, x: -8 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
						>
							<div className="flex items-center gap-3 mb-4">
								<div className="flex h-12 w-12 items-center justify-center rounded-full border border-red/30 bg-red/10">
									<AlertTriangle className="h-6 w-6 text-red" />
								</div>
								<div>
									<h3 className="text-lg font-bold text-text-bright">
										Deposit Failed
									</h3>
									<p className="text-text-secondary text-sm">{error}</p>
								</div>
							</div>
							<m.button
								onClick={handleReset}
								className="py-3 px-6 text-sm font-semibold rounded-lg
                bg-accent text-void
                hover:bg-accent-bright
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
                active:translate-y-0
                transition-colors duration-150"
								whileHover={{ scale: 1 }}
								whileTap={{ scale: 0.98 }}
							>
								Try Again
							</m.button>
						</m.div>
					)}
				</m.div>
			</AnimatePresence>
		</div>
	);
}
