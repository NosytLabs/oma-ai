"use client";

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import { AlertTriangle, Check, Copy, Eye, EyeOff, Key } from "lucide-react";
import { useEffect, useState } from "react";
import type { ApiKeyWithSecret } from "@/lib/api";

interface CreatedKeyModalProps {
	createdKey: ApiKeyWithSecret | null;
	copied: string | null;
	onCopy: (text: string, id: string) => void;
	onDismiss: () => void;
}

export function CreatedKeyModal({
	createdKey,
	copied,
	onCopy,
	onDismiss,
}: CreatedKeyModalProps) {
	const [revealed, setRevealed] = useState(false);
	const [autoHideTimer, setAutoHideTimer] = useState<ReturnType<
		typeof setTimeout
	> | null>(null);

	useEffect(() => {
		if (revealed) {
			const timer = setTimeout(() => {
				setRevealed(false);
			}, 10000);
			setAutoHideTimer(timer);
			return () => {
				if (timer) clearTimeout(timer);
			};
		}
	}, [revealed]);

	const handleReveal = () => {
		if (autoHideTimer) clearTimeout(autoHideTimer);
		setRevealed(!revealed);
	};

	if (!createdKey) return null;

	return (
		<AnimatePresence>
			<m.div
				className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/80 backdrop-blur-sm p-4"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
			>
				<m.div
					className="w-full max-w-lg border border-accent/20 bg-void p-6"
					initial={{ scale: 0.9, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					exit={{ scale: 0.9, opacity: 0 }}
					transition={springs.card}
				>
					<div className="mb-4 flex items-center gap-3">
						<div className="flex h-12 w-12 items-center justify-center border border-accent/20 bg-accent/10 text-accent">
							<Key className="h-6 w-6" />
						</div>
						<div>
							<h3 className="text-lg font-bold text-text-bright">
								API key created
							</h3>
							<p className="text-xs text-text-muted">
								Copy now — this is the only time you’ll see the full key.
							</p>
						</div>
					</div>

					<div
						id="key-warning"
						className="mb-4 flex items-center gap-2 border border-warning/20 bg-warning/5 p-3"
					>
						<AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
						<span className="text-sm text-warning">
							This key will only be shown once. Copy it now.
						</span>
					</div>

					{!revealed ? (
						<div className="mb-4 flex items-center gap-2 border border-border bg-void p-4">
							<code className="flex-1 break-all text-sm text-text-muted font-mono">
								{"*".repeat(32)}
							</code>
							<button
								type="button"
								onClick={handleReveal}
								className="shrink-0 flex items-center justify-center w-11 h-11 border border-border text-text-muted transition-colors duration-200 ease-out hover:border-accent hover:text-accent focus-ring focus-visible:border-accent focus-visible:text-accent active:scale-[0.97]"
								aria-label="Reveal API key"
							>
								<Eye className="h-5 w-5" />
							</button>
						</div>
					) : (
						<>
							<div className="mb-4 flex items-center gap-2 border border-warning/20 bg-warning/5 p-3">
								<AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
								<span className="text-xs text-warning">
									Key visible. Auto-hides in 10 seconds.
								</span>
							</div>
							<div className="mb-4 flex items-center gap-2 border border-accent/30 bg-accent-dim p-4">
								<code className="flex-1 break-all text-sm text-accent font-mono">
									{createdKey.key}
								</code>
								<button
									type="button"
									onClick={() =>
										onCopy(createdKey.key, `full-${createdKey.id}`)
									}
									aria-label="Copy full API key"
									className="shrink-0 flex items-center justify-center w-11 h-11 border border-border text-text-muted transition-[border-color,color,transform] duration-200 ease-out hover:border-accent hover:text-accent focus-ring focus-visible:border-accent focus-visible:text-accent active:scale-[0.97]"
								>
									{copied === `full-${createdKey.id}` ? (
										<Check className="h-5 w-5 text-accent" />
									) : (
										<Copy className="h-5 w-5" />
									)}
								</button>
								<button
									type="button"
									onClick={handleReveal}
									className="shrink-0 flex items-center justify-center w-11 h-11 border border-border text-text-muted transition-colors duration-200 ease-out hover:border-error hover:text-error focus-ring focus-visible:border-error focus-visible:text-error active:scale-[0.97]"
									aria-label="Hide API key"
								>
									<EyeOff className="h-5 w-5" />
								</button>
							</div>
						</>
					)}

					<button
						type="button"
						onClick={onDismiss}
						aria-describedby="key-warning"
						className="w-full border border-accent bg-accent/10 py-3 text-sm font-semibold text-accent transition-colors duration-200 ease-out hover:bg-accent/20 focus-ring active:translate-y-[1px] active:scale-[0.97]"
					>
						I have copied this key
					</button>
				</m.div>
			</m.div>
		</AnimatePresence>
	);
}
