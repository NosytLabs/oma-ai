"use client";

import {
	AlertTriangle,
	ArrowRightLeft,
	Check,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Clock,
	Copy,
	ExternalLink,
	Hexagon,
	Loader2,
	RefreshCw,
	Search,
	Settings,
	Shield,
	Sparkles,
	Wallet,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { CryptoLogo } from "@/components/ui/CryptoLogo";
import { useWallet } from "@/components/wallet-provider";
import {
	api,
	type HoudiniExchangeResult,
	type Quote,
	type Token,
} from "@/lib/api";

// ============================================================================
// TYPES
// ============================================================================

type SwapStep =
	| "select"
	| "quote"
	| "confirm"
	| "swapping"
	| "complete"
	| "error";

interface SwapState {
	fromToken: Token | null;
	toToken: Token | null;
	fromAmount: string;
	toAmount: string;
	quote: Quote | null;
	depositAddress: string;
	orderId: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_BLOCKCHAIN = "BASE";
const SWAP_FEE_PERCENT = 0.5;
const USDC_PRESETS = [10, 25, 50, 100, 250] as const;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SwapPage() {
	return (
		<ErrorBoundary
			fallback={
				<div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4">
					<h2 className="font-mono text-text text-lg">Swap Error</h2>
					<p className="text-sm text-text-muted max-w-md font-mono">
						Something went wrong loading the swap interface.
					</p>
					<button
						type="button"
						onClick={() => window.location.reload()}
						className="btn-primary flex items-center gap-2"
					>
						↻ Retry
					</button>
				</div>
			}
		>
			<div className="min-h-[calc(100vh-4rem)] px-4 pt-20 pb-8 bg-void">
				<div className="mx-auto max-w-md">
					<SwapHeader />
					<SwapInterface />
					<SwapFooter />
				</div>
			</div>
		</ErrorBoundary>
	);
}

// ============================================================================
// HEADER
// ============================================================================

function SwapHeader() {
	return (
		<div className="text-center mb-8">
			<div className="inline-flex items-center justify-center gap-3 mb-4">
				<div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 shadow-lg relative">
					<ArrowRightLeft className="h-7 w-7 text-accent" />
					<span className="absolute -top-1.5 -right-1.5 flex items-center gap-1 rounded-full bg-void border border-accent/40 px-2 py-0.5 text-[8px] font-mono text-accent uppercase tracking-wider shadow-sm">
						x402 gasless
					</span>
				</div>
			</div>
			<h1 className="h1-utility mb-2 text-text">Swap Crypto</h1>
			<p className="text-sm text-text-muted">
				Exchange 100+ cryptocurrencies directly to your wallet
			</p>
		</div>
	);
}

// ============================================================================
// SWAP INTERFACE
// ============================================================================

function SwapInterface() {
	const { isConnected, evmAddress, connectEvm } = useWallet();

	return (
		<div className="rounded-3xl border border-border bg-surface p-6 shadow-[0_8px_32px_-8px_color-mix(in_srgb,var(--color-void)_8%,transparent)]">
			{!isConnected ? (
				<WalletConnectPrompt onConnect={connectEvm} />
			) : (
				<SwapForm evmAddress={evmAddress} />
			)}
		</div>
	);
}

// ============================================================================
// WALLET CONNECT PROMPT
// ============================================================================

function WalletConnectPrompt({ onConnect }: { onConnect: () => void }) {
	return (
		<div className="py-12 text-center">
			<div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10">
				<Wallet className="h-10 w-10 text-accent" />
			</div>
			<h2 className="mb-3 text-2xl font-bold text-text">Connect Your Wallet</h2>
			<p className="mb-6 text-sm max-w-xs mx-auto text-text-secondary">
				Connect your Base wallet to start swapping cryptocurrencies directly, no
				OMA credits required.
			</p>
			<button
				type="button"
				onClick={onConnect}
				className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-8 py-4 text-sm font-semibold text-void shadow-lg shadow-accent/25 transition-all hover:bg-accent-hover hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent/30 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
				aria-label="Connect your Base wallet to start swapping"
			>
				<Hexagon className="h-4 w-4" aria-hidden="true" />
				Connect Base Wallet
			</button>
			<div className="mt-6 flex items-center justify-center gap-4 text-xs text-text-muted">
				<span className="flex items-center gap-1">
					<Check className="h-3 w-3 text-success" />
					MetaMask
				</span>
				<span className="flex items-center gap-1">
					<Check className="h-3 w-3 text-success" />
					Coinbase
				</span>
				<span className="flex items-center gap-1">
					<Check className="h-3 w-3 text-success" />
					WalletConnect
				</span>
			</div>
		</div>
	);
}

// ============================================================================
// SWAP FORM
// ============================================================================

function SwapForm({ evmAddress }: { evmAddress?: `0x${string}` }) {
	const [tokens, setTokens] = useState<Token[]>([]);
	const [isLoadingTokens, setIsLoadingTokens] = useState(true);
	const [step, setStep] = useState<SwapStep>("select");
	const [isLoadingQuote, setIsLoadingQuote] = useState(false);
	const [isExecuting, setIsExecuting] = useState(false);
	const [error, setError] = useState("");
	const [copied, setCopied] = useState(false);
	const [privacyMode, setPrivacyMode] = useState(false);
	const [slippage, setSlippage] = useState(0.5);
	const [showSettings, setShowSettings] = useState(false);

	const [swapState, setSwapState] = useState<SwapState>({
		fromToken: null,
		toToken: null,
		fromAmount: "",
		toAmount: "",
		quote: null,
		depositAddress: "",
		orderId: "",
	});

	// Load tokens on mount
	useEffect(() => {
		const fetchTokens = async () => {
			setIsLoadingTokens(true);
			try {
				const fetchedTokens = (await api.deposit.houdiniTokens(
					DEFAULT_BLOCKCHAIN,
				)) as Token[];
				setTokens(fetchedTokens);

				// Set defaults
				const btc =
					fetchedTokens.find((t: Token) => t.symbol === "BTC") ||
					fetchedTokens[0];
				const usdc =
					fetchedTokens.find((t: Token) => t.symbol === "USDC") ||
					fetchedTokens[2];
				setSwapState((prev) => ({ ...prev, fromToken: btc, toToken: usdc }));
			} catch {
				const fallback: Token[] = [
					{
						id: "BTC",
						symbol: "BTC",
						name: "Bitcoin",
						decimals: 8,
						address: "",
						blockchain: "BTC",
					},
					{
						id: "ETH",
						symbol: "ETH",
						name: "Ethereum",
						decimals: 18,
						address: "",
						blockchain: "ETH",
					},
					{
						id: "USDC",
						symbol: "USDC",
						name: "USD Coin",
						decimals: 6,
						address: "",
						blockchain: "BASE",
					},
					{
						id: "SOL",
						symbol: "SOL",
						name: "Solana",
						decimals: 9,
						address: "",
						blockchain: "SOL",
					},
					{
						id: "XMR",
						symbol: "XMR",
						name: "Monero",
						decimals: 12,
						address: "",
						blockchain: "XMR",
					},
					{
						id: "DOGE",
						symbol: "DOGE",
						name: "Dogecoin",
						decimals: 8,
						address: "",
						blockchain: "DOGE",
					},
					{
						id: "BNB",
						symbol: "BNB",
						name: "BNB",
						decimals: 18,
						address: "",
						blockchain: "BNB",
					},
					{
						id: "USDT",
						symbol: "USDT",
						name: "Tether",
						decimals: 6,
						address: "",
						blockchain: "ETH",
					},
				];
				setTokens(fallback);
				setSwapState((prev) => ({
					...prev,
					fromToken: fallback[0],
					toToken: fallback[2],
				}));
			} finally {
				setIsLoadingTokens(false);
			}
		};
		fetchTokens();
	}, []);

	const handleGetQuote = useCallback(async () => {
		if (
			!swapState.fromToken ||
			!swapState.toToken ||
			!swapState.fromAmount ||
			parseFloat(swapState.fromAmount) <= 0
		) {
			setError("Please enter a valid amount");
			return;
		}

		setIsLoadingQuote(true);
		setError("");

		try {
			const quotes = (await api.deposit.houdiniQuote(
				swapState.fromToken.symbol,
				swapState.toToken.symbol,
				swapState.fromAmount,
				privacyMode ? "private" : undefined,
				slippage / 100,
			)) as Quote[];

			if (quotes && (quotes as unknown[]).length > 0) {
				const bestQuote = quotes[0];
				setSwapState((prev) => ({
					...prev,
					quote: bestQuote,
					toAmount: bestQuote.toAmount,
				}));
				setStep("quote");
			} else {
				throw new Error("No quote available for this pair");
			}
		} catch (err: unknown) {
			const message =
				err instanceof Error
					? err.message
					: "Failed to get quote. Please try again.";
			setError(message);
		} finally {
			setIsLoadingQuote(false);
		}
	}, [
		swapState.fromToken,
		swapState.toToken,
		swapState.fromAmount,
		privacyMode,
		slippage,
	]);

	const handleExecuteSwap = useCallback(async () => {
		if (!swapState.quote || !evmAddress || !swapState.fromToken) return;

		setIsExecuting(true);
		setError("");
		setStep("swapping");

		try {
			const rawResult = await api.deposit.houdiniExchange(
				swapState.quote.quoteId,
				swapState.fromToken?.symbol,
				swapState.fromAmount,
				evmAddress,
			);
			const result = rawResult as HoudiniExchangeResult;

			setSwapState((prev) => ({
				...prev,
				depositAddress: result.depositAddress,
				orderId: result.orderId || result.depositId,
			}));
			setStep("confirm");
		} catch (err: unknown) {
			const message =
				err instanceof Error
					? err.message
					: "Failed to execute swap. Please try again.";
			setError(message);
			setStep("error");
		} finally {
			setIsExecuting(false);
		}
	}, [swapState.quote, swapState.fromToken, swapState.fromAmount, evmAddress]);

	const handleSwitchTokens = () => {
		setSwapState((prev) => ({
			...prev,
			fromToken: prev.toToken,
			toToken: prev.fromToken,
			fromAmount: prev.toAmount,
			toAmount: prev.fromAmount,
			quote: null,
		}));
		if (step === "quote") setStep("select");
	};

	const handleReset = () => {
		setStep("select");
		setSwapState((prev) => ({
			...prev,
			fromAmount: "",
			toAmount: "",
			quote: null,
			depositAddress: "",
			orderId: "",
		}));
		setError("");
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="space-y-4">
			{/* Settings Button */}
			<div className="flex items-center justify-end">
				<button
					type="button"
					onClick={() => setShowSettings(!showSettings)}
					aria-label={showSettings ? "Close settings" : "Open settings"}
					aria-expanded={showSettings}
					className="flex h-9 w-9 items-center justify-center rounded-full border bg-surface transition-all hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent"
				>
					<Settings className="h-4 w-4" aria-hidden="true" />
				</button>
			</div>

			{/* Settings Panel */}
			{showSettings && (
				<div className="rounded-xl border p-4 space-y-4 border-border bg-surface">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium text-text">
							Slippage Tolerance
						</span>
						<div className="flex items-center gap-2">
							{[0.5, 1.0, 3.0].map((val) => (
								<button
									type="button"
									key={val}
									onClick={() => setSlippage(val)}
									className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
										slippage === val ? "text-void" : "border"
									}`}
									style={
										slippage === val
											? { backgroundColor: "var(--color-accent)" }
											: {
													backgroundColor: "var(--color-void)",
													borderColor: "var(--color-border)",
													color: "var(--color-text-secondary)",
												}
									}
								>
									{val}%
								</button>
							))}
						</div>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium text-text">Privacy Mode</span>
						<button
							type="button"
							onClick={() => setPrivacyMode(!privacyMode)}
							className={`relative flex h-6 w-11 items-center rounded-full transition-colors ${
								privacyMode ? "bg-pink" : "bg-surface"
							}`}
						>
							<div
								className={`absolute h-4 w-4 rounded-full bg-text-inverse shadow transition-all ${
									privacyMode ? "left-6" : "left-1"
								}`}
							/>
						</button>
					</div>
					{privacyMode && (
						<div className="flex items-start gap-2 rounded-lg p-3 bg-pink/10">
							<Shield className="h-4 w-4 mt-0.5 text-pink" />
							<p className="text-xs text-text-secondary">
								Privacy mode routes through Monero for enhanced transaction
								privacy. Fees are higher.
							</p>
						</div>
					)}
				</div>
			)}

			{/* From Token */}
			<TokenInputCard
				label="You Pay"
				tokens={tokens}
				selectedToken={swapState.fromToken}
				amount={swapState.fromAmount}
				onAmountChange={(value) =>
					setSwapState((prev) => ({ ...prev, fromAmount: value, quote: null }))
				}
				onSelectToken={(token) =>
					setSwapState((prev) => ({ ...prev, fromToken: token, quote: null }))
				}
				otherToken={swapState.toToken}
				isLoading={isLoadingTokens}
			/>

			{/* Switch Button */}
			<div className="flex justify-center -my-1">
				<button
					type="button"
					onClick={handleSwitchTokens}
					aria-label="Switch from and to tokens"
					className="flex h-10 w-10 items-center justify-center rounded-full shadow-md transition-all hover:scale-110 hover:border-accent hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent"
				>
					<ArrowRightLeft
						className="h-4 w-4 text-text-muted"
						aria-hidden="true"
					/>
				</button>
			</div>

			{/* USDC Preset Chips */}
			{swapState.fromToken?.symbol === "USDC" && step === "select" && (
				<div className="flex flex-wrap gap-2">
					{USDC_PRESETS.map((preset) => (
						<button
							key={preset}
							type="button"
							onClick={() =>
								setSwapState((prev) => ({
									...prev,
									fromAmount: String(preset),
									quote: null,
								}))
							}
							aria-pressed={swapState.fromAmount === String(preset)}
							className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-all ${
								swapState.fromAmount === String(preset)
									? "border-accent bg-accent/10 text-accent"
									: "border-border bg-surface text-text-secondary hover:border-accent/40 hover:text-text"
							}`}
						>
							${preset} USDC
						</button>
					))}
					{swapState.fromAmount &&
						!USDC_PRESETS.some((p) => String(p) === swapState.fromAmount) && (
							<span className="px-2 py-1.5 text-xs text-text-muted">
								custom amount
							</span>
						)}
				</div>
			)}

			{/* To Token */}
			<TokenInputCard
				label="You Receive"
				tokens={tokens}
				selectedToken={swapState.toToken}
				amount={swapState.toAmount}
				onAmountChange={() => {}}
				onSelectToken={(token) =>
					setSwapState((prev) => ({ ...prev, toToken: token, quote: null }))
				}
				otherToken={swapState.fromToken}
				isLoading={isLoadingTokens}
				isOutput
			/>

			{/* Error State */}
			{error && (
				<div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
					<AlertTriangle className="h-4 w-4 shrink-0" />
					{error}
				</div>
			)}

			{/* Quote Step */}
			{step === "quote" && swapState.quote && (
				<QuoteCard
					swapState={swapState}
					slippage={slippage}
					privacyMode={privacyMode}
					onBack={() => setStep("select")}
					onConfirm={handleExecuteSwap}
					isExecuting={isExecuting}
				/>
			)}

			{/* Swapping Step */}
			{step === "swapping" && <SwappingCard />}

			{/* Confirm Step */}
			{step === "confirm" && swapState.depositAddress && (
				<DepositAddressCard
					swapState={swapState}
					copied={copied}
					onCopy={copyToClipboard}
					onDone={handleReset}
				/>
			)}

			{/* Error Step */}
			{step === "error" && <ErrorCard error={error} onRetry={handleReset} />}

			{/* Get Quote Button */}
			{step === "select" && (
				<button
					type="button"
					onClick={handleGetQuote}
					disabled={
						!swapState.fromToken ||
						!swapState.toToken ||
						!swapState.fromAmount ||
						parseFloat(swapState.fromAmount) <= 0 ||
						isLoadingQuote
					}
					className="w-full flex items-center justify-center gap-2 rounded-full bg-accent py-4 text-sm font-semibold text-void shadow-lg shadow-accent/25 transition-all hover:bg-accent-hover hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:bg-text-muted disabled:shadow-none"
				>
					{isLoadingQuote ? (
						<>
							<Loader2 className="h-5 w-5 animate-spin" />
							Getting Quote...
						</>
					) : (
						<>
							<Sparkles className="h-4 w-4" />
							Get Quote
						</>
					)}
				</button>
			)}
		</div>
	);
}

// ============================================================================
// TOKEN INPUT CARD
// ============================================================================

interface TokenInputCardProps {
	label: string;
	tokens: Token[];
	selectedToken: Token | null;
	amount: string;
	onAmountChange: (value: string) => void;
	onSelectToken: (token: Token) => void;
	otherToken: Token | null;
	isLoading: boolean;
	isOutput?: boolean;
}

function TokenInputCard({
	label,
	tokens,
	selectedToken,
	amount,
	onAmountChange,
	onSelectToken,
	otherToken,
	isLoading,
	isOutput,
}: TokenInputCardProps) {
	const [showSelector, setShowSelector] = useState(false);
	const [search, setSearch] = useState("");
	const id = useId();

	const filteredTokens = useMemo(() => {
		return tokens.filter(
			(token) =>
				token.symbol.toLowerCase().includes(search.toLowerCase()) ||
				token.name.toLowerCase().includes(search.toLowerCase()),
		);
	}, [tokens, search]);

	return (
		<div className="space-y-2">
			<label
				htmlFor={id}
				className="text-xs font-semibold uppercase tracking-wider text-text-muted"
			>
				{label}
			</label>
			<div className="flex gap-3">
				<div className="relative flex-1">
					<input
						id={id}
						type="number"
						placeholder="0.00"
						value={amount}
						onChange={(e) => onAmountChange(e.target.value)}
						className="font-mono w-full rounded-xl px-4 py-4 text-2xl font-bold placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 transition-all"
						disabled={isOutput}
						aria-label={`Enter ${label.toLowerCase()} amount`}
					/>
					{isOutput && amount && (
						<div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-text-muted">
							~$0.00
						</div>
					)}
				</div>
				<div className="relative">
					<button
						type="button"
						onClick={() => setShowSelector(!showSelector)}
						aria-label={`Select ${label.toLowerCase().replace("you ", "")} token`}
						aria-expanded={showSelector}
						disabled={isLoading || isOutput}
						className="flex h-[60px] min-w-[140px] items-center gap-2 rounded-xl px-4 transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent"
					>
						{isLoading ? (
							<Loader2 className="h-5 w-5 animate-spin text-text-muted" />
						) : selectedToken ? (
							<>
								<CryptoLogo symbol={selectedToken.symbol} size={28} />
								<span className="font-bold text-text">
									{selectedToken.symbol}
								</span>
							</>
						) : (
							<span>Select</span>
						)}
						<ChevronDown className="h-4 w-4 ml-auto text-text-muted" />
					</button>

					{showSelector && (
						<>
							<div
								className="fixed inset-0 z-40"
								onClick={() => setShowSelector(false)}
							/>
							<div
								className="absolute right-0 top-full mt-2 z-50 rounded-xl border border-border bg-surface shadow-xl overflow-hidden"
								style={{ width: "min(288px, calc(100vw - 2rem))" }}
							>
								<div className="p-3 border-b border-border">
									<div className="relative">
										<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
										<input
											type="text"
											placeholder="Search tokens..."
											value={search}
											onChange={(e) => setSearch(e.target.value)}
											className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm placeholder:text-text-muted focus:outline-none"
										/>
									</div>
								</div>
								<div className="max-h-72 overflow-y-auto">
									{filteredTokens.map((token) => (
										<button
											type="button"
											key={token.id}
											onClick={() => {
												if (otherToken?.symbol !== token.symbol) {
													onSelectToken(token);
													setShowSelector(false);
													setSearch("");
												}
											}}
											className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
												otherToken?.symbol === token.symbol ? "opacity-40" : ""
											} ${selectedToken?.symbol === token.symbol ? "bg-accent/5" : ""}`}
										>
											<CryptoLogo symbol={token.symbol} size={32} />
											<div className="flex-1 text-left">
												<div className="font-bold">{token.symbol}</div>
												<div className="text-xs text-text-secondary">
													{token.name}
												</div>
											</div>
											{token.blockchain && (
												<span className="text-xs px-2 py-1 rounded bg-surface text-text-muted">
													{token.blockchain}
												</span>
											)}
										</button>
									))}
									{filteredTokens.length === 0 && (
										<div className="px-4 py-8 text-center text-sm text-text-muted">
											No tokens found
										</div>
									)}
								</div>
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// QUOTE CARD
// ============================================================================

interface QuoteCardProps {
	swapState: SwapState;
	slippage: number;
	privacyMode: boolean;
	onBack: () => void;
	onConfirm: () => void;
	isExecuting: boolean;
}

function QuoteCard({
	swapState,
	slippage,
	privacyMode,
	onBack,
	onConfirm,
	isExecuting,
}: QuoteCardProps) {
	const { quote, fromToken, toToken, fromAmount, toAmount } = swapState;
	if (!quote) return null;

	const exchangeRate = parseFloat(quote.rate) || 0;
	// The Houdini quote API does not return a priceImpact field. Until it does,
	// surface the user's *slippage tolerance* as the closest meaningful number —
	// the trade will revert if real impact exceeds this threshold.
	const priceImpact = slippage;

	return (
		<div className="space-y-4 rounded-xl border border-accent/20 bg-gradient-to-br from-accent/5 to-accent/10 p-5">
			<div className="flex items-center gap-2">
				<CheckCircle2 className="h-5 w-5 text-success" />
				<span className="text-sm font-semibold text-success">Quote Ready</span>
			</div>

			{/* Exchange Rate Display */}
			<div className="flex items-center justify-between rounded-xl p-4 bg-surface">
				<div className="flex items-center gap-2">
					{fromToken && <CryptoLogo symbol={fromToken.symbol} size={24} />}
					<div>
						<div className="text-xs text-text-secondary">You pay</div>
						<div className="font-mono font-bold">
							{fromAmount} {fromToken?.symbol}
						</div>
					</div>
				</div>
				<ArrowRightLeft className="h-5 w-5 text-text-muted" />
				<div className="flex items-center gap-2">
					<div className="text-right">
						<div className="text-xs text-text-secondary">You receive</div>
						<div className="font-mono font-bold text-accent">
							{toAmount} {toToken?.symbol}
						</div>
					</div>
					{toToken && <CryptoLogo symbol={toToken.symbol} size={24} />}
				</div>
			</div>

			{/* Details */}
			<div className="space-y-2 rounded-xl p-4 text-sm bg-surface">
				<div className="flex justify-between">
					<span>Rate</span>
					<span className="font-mono font-medium">
						1 {fromToken?.symbol} = {exchangeRate.toFixed(6)} {toToken?.symbol}
					</span>
				</div>
				<div className="flex justify-between">
					<span>Slippage tolerance</span>
					<span
						className={`font-mono font-medium ${priceImpact > 2 ? "text-warning" : "text-success"}`}
					>
						{priceImpact.toFixed(2)}%
					</span>
				</div>
				<div className="flex justify-between">
					<span>Network Fee</span>
					<span className="font-mono font-medium">~{SWAP_FEE_PERCENT}%</span>
				</div>
				<div className="flex justify-between">
					<span>Estimated Time</span>
					<span className="font-mono font-medium">
						{quote.estimatedTime
							? `${Math.round(quote.estimatedTime / 60)}-${Math.round(quote.estimatedTime / 60) + 5} min`
							: "5-15 min"}
					</span>
				</div>
				{privacyMode && (
					<div className="flex justify-between">
						<span>Privacy</span>
						<span className="font-medium text-pink">Enhanced</span>
					</div>
				)}
			</div>

			{/* Actions */}
			<div className="flex gap-3">
				<button
					type="button"
					onClick={onBack}
					className="flex-1 rounded-full py-3.5 text-sm font-semibold transition-all"
				>
					Back
				</button>
				<button
					type="button"
					onClick={onConfirm}
					disabled={isExecuting}
					className="flex-1 flex items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-sm font-semibold text-void shadow-lg shadow-accent/25 transition-all hover:bg-accent-hover disabled:opacity-50"
				>
					{isExecuting ? (
						<>
							<Loader2 className="h-4 w-4 animate-spin" />
							Processing...
						</>
					) : (
						<>
							Confirm Swap
							<ChevronRight className="h-4 w-4" />
						</>
					)}
				</button>
			</div>
		</div>
	);
}

// ============================================================================
// SWAPPING CARD
// ============================================================================

function SwappingCard() {
	return (
		<div className="py-12 text-center">
			<div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 border border-accent/20">
				<Loader2 className="h-10 w-10 text-accent animate-spin" />
			</div>
			<h3 className="mb-2 text-xl font-bold text-text">Preparing Your Swap</h3>
			<p className="text-sm text-text-secondary">
				Setting up your exchange, please wait...
			</p>
		</div>
	);
}

// ============================================================================
// DEPOSIT ADDRESS CARD
// ============================================================================

interface DepositAddressCardProps {
	swapState: SwapState;
	copied: boolean;
	onCopy: (text: string) => void;
	onDone: () => void;
}

function DepositAddressCard({
	swapState,
	copied,
	onCopy,
	onDone,
}: DepositAddressCardProps) {
	const { depositAddress, fromToken, fromAmount, toToken, toAmount } =
		swapState;

	return (
		<div className="space-y-5">
			<div className="text-center">
				<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border bg-success/10 border-success">
					<CheckCircle2 className="h-8 w-8 text-success" />
				</div>
				<h3 className="text-xl font-bold mb-1 text-text">
					Send {fromToken?.symbol}
				</h3>
				<p className="text-sm text-text-secondary">
					Send exactly{" "}
					<span className="font-mono font-bold text-text">
						{fromAmount} {fromToken?.symbol}
					</span>{" "}
					to begin your swap
				</p>
			</div>

			{/* Deposit Address */}
			<div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
				<div className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
					Deposit Address
				</div>
				<div className="flex items-center gap-2">
					<div className="flex-1 font-mono text-sm break-all rounded-lg px-3 py-2.5 border bg-void border-border text-text-secondary">
						{depositAddress}
					</div>
					<button
						type="button"
						onClick={() => onCopy(depositAddress)}
						aria-label="Copy deposit address"
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-surface transition-all"
					>
						{copied ? (
							<Check className="h-4 w-4 text-success" />
						) : (
							<Copy className="h-4 w-4 text-text-muted" />
						)}
					</button>
				</div>
			</div>

			{/* Expected Output */}
			<div className="flex items-center justify-between rounded-xl border p-4 border-border bg-bg-secondary">
				<div>
					<div className="text-xs text-text-secondary">You will receive</div>
					<div className="flex items-center gap-2 mt-1">
						<CryptoLogo symbol={toToken?.symbol || ""} size={20} />
						<span className="font-mono font-bold text-lg text-accent">
							{toAmount} {toToken?.symbol}
						</span>
					</div>
				</div>
				<Clock className="h-5 w-5 text-text-muted" />
			</div>

			{/* Instructions */}
			<div className="space-y-3">
				<div className="flex items-start gap-3 rounded-xl border p-4 border-border bg-void">
					<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-accent/10 text-accent">
						1
					</div>
					<div>
						<div className="font-semibold text-sm text-text">
							Send {fromAmount} {fromToken?.symbol}
						</div>
						<div className="text-xs mt-0.5 text-text-secondary">
							to the deposit address above
						</div>
					</div>
				</div>
				<div className="flex items-start gap-3 rounded-xl border p-4 border-border bg-void">
					<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-accent/10 text-accent">
						2
					</div>
					<div>
						<div className="font-semibold text-sm text-text">
							Wait for confirmation
						</div>
						<div className="text-xs mt-0.5 text-text-secondary">
							Typically 5-15 minutes
						</div>
					</div>
				</div>
				<div className="flex items-start gap-3 rounded-xl border p-4 border-success/20 bg-success/5">
					<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-success text-text-inverse">
						3
					</div>
					<div>
						<div className="font-semibold text-sm text-text">
							Receive {toAmount} {toToken?.symbol}
						</div>
						<div className="text-xs mt-0.5 text-text-secondary">
							directly to your connected wallet
						</div>
					</div>
				</div>
			</div>

			{/* Track Link */}
			<a
				href="https://app.houdiniswap.com"
				target="_blank"
				rel="noopener noreferrer"
				className="flex items-center justify-center gap-2 text-sm text-accent hover:underline"
			>
				Track swap on HoudiniSwap
				<ExternalLink className="h-3 w-3" />
			</a>

			{/* Dashboard Link */}
			<Link
				href="/dashboard"
				className="flex items-center justify-center gap-2 w-full rounded-full bg-accent py-3.5 text-sm font-semibold text-void shadow-lg shadow-accent/25 transition-all hover:bg-accent-hover"
			>
				Use Credits on Dashboard
				<ExternalLink className="h-4 w-4" />
			</Link>

			{/* Done Button */}
			<button
				type="button"
				onClick={onDone}
				aria-label="Start new swap"
				className="w-full rounded-full border py-3.5 text-sm font-semibold transition-all"
			>
				Start New Swap
			</button>
		</div>
	);
}

// ============================================================================
// ERROR CARD
// ============================================================================

interface ErrorCardProps {
	error: string;
	onRetry: () => void;
}

function ErrorCard({ error, onRetry }: ErrorCardProps) {
	return (
		<div className="py-12 text-center">
			<div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border bg-error/10 border-red">
				<AlertTriangle className="h-10 w-10 text-error" />
			</div>
			<h3 className="mb-2 text-xl font-bold text-error">Swap Failed</h3>
			<p className="mb-6 text-sm max-w-xs mx-auto text-text-secondary">
				{error}
			</p>
			<button
				type="button"
				onClick={onRetry}
				className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-void shadow-lg transition-all hover:bg-accent-hover"
			>
				<RefreshCw className="h-4 w-4" />
				Try Again
			</button>
		</div>
	);
}

// ============================================================================
// FOOTER
// ============================================================================

function SwapFooter() {
	return (
		<div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-border/60 px-4 py-3 bg-surface">
			<Shield className="h-4 w-4 text-accent" />
			<span className="text-xs text-text-secondary">
				Powered by HoudiniSwap. Non-custodial exchange - your keys, your crypto.
			</span>
		</div>
	);
}
