"use client";

import { Copy, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

interface ChainPillProps {
	chain: { id: number; name: string } | undefined;
	/** Expected chain id (defaults to Base mainnet = 8453). */
	expectedId?: number;
}

function truncateAddress(addr: string): string {
	if (addr.length <= 10) return addr;
	return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Truncated wallet address + current chain badge.
 *
 * Click-to-copy address — surfaces a brief "Copied" indicator. When the
 * user is on the wrong chain for the SIWE flow, the chain badge swaps
 * to a red "wrong network" state instead of pretending everything is fine.
 */
export function WalletStatus({
	address,
	chain,
	expectedId = 8453,
}: {
	address: `0x${string}` | undefined;
} & ChainPillProps) {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) return;
		const t = setTimeout(() => setCopied(false), 1500);
		return () => clearTimeout(t);
	}, [copied]);

	if (!address) return null;
	const onCorrectChain = chain?.id === expectedId;

	async function copy() {
		// Narrow the closure against the early-return above.
		const addr = address;
		if (!addr) return;
		try {
			await navigator.clipboard.writeText(addr);
			setCopied(true);
		} catch {
			// Browser doesn't allow clipboard — non-essential.
		}
	}

	return (
		<div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-3">
			<button
				type="button"
				onClick={copy}
				className="group inline-flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-sm font-mono text-text-bright transition-colors hover:bg-panel focus:bg-panel focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
				aria-label="Copy wallet address"
			>
				<span className="truncate">{truncateAddress(address)}</span>
				<Copy
					className="h-3 w-3 shrink-0 text-text-muted transition-colors group-hover:text-text-secondary"
					aria-hidden="true"
				/>
			</button>
			{copied && (
				<span
					role="status"
					aria-live="polite"
					className="text-[11px] font-semibold text-success"
				>
					Copied
				</span>
			)}
			{chain && (
				<span
					className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
						onCorrectChain
							? "border-success/30 bg-success/10 text-success"
							: "border-red/30 bg-red/10 text-red"
					}`}
					aria-label={
						onCorrectChain
							? `Connected to ${chain.name}`
							: `Wrong network: ${chain.name}. OMA requires Base mainnet.`
					}
				>
					<Wifi className="h-3 w-3" aria-hidden="true" />
					{chain.name}
					{!onCorrectChain && <span className="ml-1">· wrong</span>}
				</span>
			)}
		</div>
	);
}
