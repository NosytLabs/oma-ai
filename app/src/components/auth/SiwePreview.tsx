"use client";

import { m } from "@/lib/framer-motion-client";
import { ChevronDown, Copy, Loader2, Shield } from "lucide-react";
import { useEffect, useState } from "react";

interface SiwePreviewProps {
	/** Pre-rendered SIWE message text. When empty, the panel renders a placeholder. */
	message: string;
	/** Whether we are currently awaiting a wallet signature. */
	isSigning?: boolean;
}

/**
 * Collapsible preview of the SIWE message being signed.
 *
 * SIWE messages are formatted as plain text per EIP-4361. Surfacing the
 * message in the UI:
 *   - lets advanced users audit exactly what they're signing (defense
 *     against a malicious dApp emitting a different domain / chain / nonce);
 *   - gives support a copy-pasteable payload when debugging "signature
 *     invalid" reports.
 *
 * Reduced-motion is respected via the `useReducedMotion` from framer-motion
 * (the chevron rotation / opacity transition is decorative).
 */
export function SiwePreview({ message, isSigning = false }: SiwePreviewProps) {
	const [open, setOpen] = useState(false);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) return;
		const t = setTimeout(() => setCopied(false), 1500);
		return () => clearTimeout(t);
	}, [copied]);

	// Pull out the nonce line (if present) so we can show it at-a-glance,
	// separate from the (longer) body. Best-effort regex — the message
	// might not yet be set.
	const nonceLine = message
		? message.split("\n").find((l) => /^Nonce: /i.test(l.trim()))
		: undefined;
	const nonceValue = nonceLine?.replace(/^Nonce:\s*/i, "").trim();

	async function handleCopy() {
		if (!message) return;
		try {
			await navigator.clipboard.writeText(message);
			setCopied(true);
		} catch {
			// Silent — clipboard failures here are non-essential (the user
			// can still select-all in the expanded textarea below).
		}
	}

	if (!message) {
		return (
			<div className="rounded-lg border border-border/60 bg-surface/40 p-3">
				<p className="text-[11px] text-text-muted">
					The SIWE message will appear here once you connect — you can verify
					exactly what you&apos;re signing before the wallet prompts you.
				</p>
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-border/60 bg-surface/40 overflow-hidden">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				aria-controls="siwe-message-body"
				className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-medium text-text-secondary transition-colors hover:bg-surface focus:bg-surface focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
			>
				<span className="flex items-center gap-2">
					{isSigning ? (
						<Loader2
							className="h-3.5 w-3.5 animate-spin text-accent"
							aria-hidden="true"
						/>
					) : (
						<Shield className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
					)}
					{isSigning ? "Awaiting signature in wallet…" : "SIWE message"}
				</span>
				<m.span
					animate={{ rotate: open ? 180 : 0 }}
					transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
					className="shrink-0"
				>
					<ChevronDown
						className="h-3.5 w-3.5 text-text-muted"
						aria-hidden="true"
					/>
				</m.span>
			</button>
			{nonceValue && (
				<div className="border-t border-border/40 px-3 py-2 text-[11px] font-mono text-text-muted">
					<span className="uppercase tracking-wider text-text-muted/80 mr-2">
						Nonce:
					</span>
					<span className="text-text-secondary">{nonceValue}</span>
				</div>
			)}
			{open && (
				<div
					id="siwe-message-body"
					className="border-t border-border/40 px-3 py-3"
				>
					<pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-text-secondary">
						{message}
					</pre>
					<div className="mt-2 flex justify-end">
						<button
							type="button"
							onClick={handleCopy}
							className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text hover:border-border-bright transition-colors"
						>
							<Copy className="h-3 w-3" aria-hidden="true" />
							{copied ? "Copied" : "Copy"}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
