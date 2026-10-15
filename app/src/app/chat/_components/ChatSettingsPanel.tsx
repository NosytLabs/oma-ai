"use client";

/**
 * RESPONSIVE SHELL for the model-parameters panel — NOT the panel itself.
 *
 * The panel body and its prop contract live in
 * `@/components/chat/SettingsPanel`; this file only decides *where* that
 * body renders (inline aside on ≥md, fixed overlay + scrim below). It
 * lazy-loads the body via `dynamic()` so the chat route does not pay for
 * it up front.
 *
 * The two files share a name but not semantics. `SettingsPanelProps` is
 * imported and extended here so the shell can never drift out of sync
 * with the body it wraps: adding a prop to the body makes it required
 * here at compile time, and the setter types come from one declaration
 * rather than two hand-maintained copies.
 */

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import { X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { springs } from "@/lib/animation";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { Skeleton } from "@/components/ui/Skeleton";
import type { SettingsPanelProps } from "@/components/chat/SettingsPanel";

const LazySettingsPanel = dynamic(
	() =>
		import("@/components/chat/SettingsPanel").then(
			(mod) => mod.SettingsPanel,
		),
	{ ssr: false, loading: () => <Skeleton className="h-96 w-full" /> },
);

/** Body props, verbatim, plus the shell's own open/close state. */
interface ChatSettingsPanelProps extends SettingsPanelProps {
	paramsOpen: boolean;
	setParamsOpen: (open: boolean) => void;
}

/**
 * Right-side parameters panel, rendered in two flavors:
 * - desktop (≥md): inline aside that slides in from the right
 * - mobile (<md): fixed-position aside + scrim overlay
 *
 * Both surfaces render the same lazy `<SettingsPanel>` body with the same
 * props. The mobile overlay also gets a click-to-dismiss scrim so the
 * user can close by tapping outside the panel.
 */
export function ChatSettingsPanel({
	paramsOpen,
	setParamsOpen,
	...body
}: ChatSettingsPanelProps) {
	const [mobile, setMobile] = useState(false);
	const mobilePanelRef = useRef<HTMLElement | null>(null);
	const returnFocusRef = useRef<HTMLElement | null>(null);
	useEffect(() => {
		const query = window.matchMedia("(max-width: 767px)");
		const sync = () => setMobile(query.matches);
		sync();
		query.addEventListener("change", sync);
		return () => query.removeEventListener("change", sync);
	}, []);
	useEffect(() => {
		if (paramsOpen && mobile) returnFocusRef.current = document.activeElement as HTMLElement | null;
	}, [paramsOpen, mobile]);
	useFocusTrap({ active: paramsOpen && mobile, containerRef: mobilePanelRef, restoreFocusRef: returnFocusRef, onClose: () => setParamsOpen(false) });
	// `body` is exactly `SettingsPanelProps`; spreading it keeps the two
	// render sites in sync with the body contract automatically.
	const panel = <LazySettingsPanel {...body} />;

	return (
		<>
			{/* Desktop Settings Panel (Sidebar) */}
			<AnimatePresence initial={false}>
				{paramsOpen && (
					<m.aside
						initial={{ width: 0, opacity: 0 }}
						animate={{ width: 320, opacity: 1 }}
						exit={{ width: 0, opacity: 0 }}
						transition={springs.card}
						className="flex-none bg-void border-l border-border z-10 overflow-hidden hidden md:flex flex-col"
					>
						<div className="w-80 flex flex-col h-full">
							<div className="flex-none h-12 border-b border-border flex items-center justify-between px-4">
								<h2 className="text-[11px] font-bold text-text-muted uppercase tracking-widest">
									Model Parameters
								</h2>
								<button
									type="button"
									onClick={() => setParamsOpen(false)}
									aria-label="Close parameters panel"
									className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-text-muted hover:text-text-secondary focus-ring active:scale-[0.97]"
								>
									<X className="w-4 h-4" />
								</button>
							</div>
							<div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
								{panel}
							</div>
						</div>
					</m.aside>
				)}
			</AnimatePresence>

			{/* Escape main's stacking context, as the navigation drawer does. */}
			{mobile && createPortal(<>
			{/* Mobile Settings Modal Overlay */}
			<AnimatePresence>
				{paramsOpen && (
					<m.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="md:hidden fixed inset-0 z-[70] bg-overlay/80 backdrop-blur-sm"
						onClick={() => setParamsOpen(false)}
					/>
				)}
			</AnimatePresence>

			{/* Mobile Settings Panel */}
			<AnimatePresence>
				{paramsOpen && (
					<m.aside
						ref={mobilePanelRef}
						role={mobile ? "dialog" : undefined}
						aria-modal={mobile ? true : undefined}
						aria-label="Model parameters"
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={springs.card}
						className="md:hidden fixed top-0 bottom-[var(--consent-banner-height,0px)] right-0 w-80 max-w-full bg-void border-l border-border z-[80] flex flex-col"
					>
						<div className="flex-none h-12 border-b border-border flex items-center justify-between px-4 bg-void">
							<h2 className="text-[11px] font-bold text-text-muted uppercase tracking-widest">
								Parameters
							</h2>
							<button
								type="button"
								onClick={() => setParamsOpen(false)}
								aria-label="Close parameters panel"
									className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-text-muted hover:text-text-secondary focus-ring active:scale-[0.97]"
							>
								<X className="w-4 h-4" />
							</button>
						</div>
						<div className="flex-1 overflow-y-auto p-4">
							{panel}
						</div>
					</m.aside>
				)}
			</AnimatePresence>
			</>, document.body)}
		</>
	);
}
