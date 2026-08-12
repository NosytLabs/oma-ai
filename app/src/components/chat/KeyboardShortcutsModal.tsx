"use client";

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import { Command, Keyboard, X } from "lucide-react";
import { useDialog } from "@/lib/use-dialog";

export interface Shortcut {
	keys: string[];
	description: string;
}

const SHORTCUTS: Shortcut[] = [
	{ keys: ["Cmd", "K"], description: "Open model picker" },
	{ keys: ["Cmd", "/"], description: "Toggle settings panel" },
	{ keys: ["Cmd", "Shift", "C"], description: "Toggle Create studio (image/video)" },
	{ keys: ["Cmd", "Enter"], description: "Send message" },
	{ keys: ["Cmd", "N"], description: "New conversation" },
	{ keys: ["?"], description: "Show keyboard shortcuts" },
	{ keys: ["Shift", "Enter"], description: "New line in input" },
	{ keys: ["Esc"], description: "Close modals" },
];

interface KeyboardShortcutsModalProps {
	open: boolean;
	onClose: () => void;
}

function KeyCap({ children }: { children: string }) {
	return (
		<kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface)] text-text-secondary text-[11px] font-mono font-bold uppercase shadow-sm">
			{children}
		</kbd>
	);
}

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
	return (
		<div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--color-border)] last:border-b-0">
			<span className="text-xs font-mono text-text-secondary">
				{shortcut.description}
			</span>
			<div className="flex items-center gap-1">
				{shortcut.keys.map((key, i) => (
					<span key={i} className="flex items-center gap-1">
						{i > 0 && <span className="text-text-muted text-[10px]">+</span>}
						<KeyCap>{key}</KeyCap>
					</span>
				))}
			</div>
		</div>
	);
}

export function KeyboardShortcutsModal({
	open,
	onClose,
}: KeyboardShortcutsModalProps) {
	const { panelRef } = useDialog({ open, onClose });
	return (
		<AnimatePresence>
			{open && (
				<m.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={springs.soft}
					className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-overlay/80 backdrop-blur-sm"
					onClick={onClose}
					role="dialog"
					aria-modal="true"
					aria-label="Keyboard shortcuts"
				>
					<m.div
						ref={panelRef}
						tabIndex={-1}
						initial={{ opacity: 0, scale: 0.98, y: 4 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.98, y: 4 }}
						transition={springs.soft}
						onClick={(e) => e.stopPropagation()}
						className="w-full max-w-md bg-[var(--color-void)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-2xl focus:outline-none overflow-hidden"
					>
						<div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/30">
							<div className="flex items-center gap-2">
								<Keyboard className="w-4 h-4 text-[var(--color-success)]" />
								<h2 className="text-xs font-mono font-bold text-text-primary uppercase tracking-widest">
									KEYBOARD SHORTCUTS
								</h2>
							</div>
							<button
								type="button"
								onClick={onClose}
								aria-label="Close keyboard shortcuts"
								className="p-1 text-text-muted hover:text-text-primary hover:bg-[var(--color-surface)] rounded-full transition-[color,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.97]"
							>
								<X className="w-4 h-4" />
							</button>
						</div>

						<div className="p-4">
							<p className="text-[11px] font-mono text-text-muted mb-3 leading-relaxed">
								<Command className="w-3 h-3 inline mr-1 -mt-0.5" />
								On macOS. On Linux/Windows use Ctrl instead of Cmd.
							</p>
							<div>
								{SHORTCUTS.map((s) => (
									<ShortcutRow key={s.description} shortcut={s} />
								))}
							</div>
						</div>
					</m.div>
				</m.div>
			)}
		</AnimatePresence>
	);
}
