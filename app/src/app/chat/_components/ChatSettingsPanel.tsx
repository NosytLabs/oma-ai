"use client";

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import { X } from "lucide-react";
import dynamic from "next/dynamic";
import { springs } from "@/lib/animation";
import type { Dispatch, SetStateAction } from "react";
import { Skeleton } from "@/components/ui/Skeleton";

const LazySettingsPanel = dynamic(
	() =>
		import("@/components/chat/SettingsPanel").then(
			(mod) => mod.SettingsPanel,
		),
	{ ssr: false, loading: () => <Skeleton className="h-96 w-full" /> },
);

export interface ChatSettingsPanelProps {
	paramsOpen: boolean;
	setParamsOpen: Dispatch<SetStateAction<boolean>>;
	temperature: number;
	setTemperature: Dispatch<SetStateAction<number>>;
	topP: number;
	setTopP: Dispatch<SetStateAction<number>>;
	maxTokens: number;
	setMaxTokens: Dispatch<SetStateAction<number>>;
	topK: number;
	setTopK: Dispatch<SetStateAction<number>>;
	freqPenalty: number;
	setFreqPenalty: Dispatch<SetStateAction<number>>;
	presPenalty: number;
	setPresPenalty: Dispatch<SetStateAction<number>>;
	stream: boolean;
	setStream: Dispatch<SetStateAction<boolean>>;
	showAdvanced: boolean;
	setShowAdvanced: Dispatch<SetStateAction<boolean>>;
	model: string;
}

/**
	* Right-side parameters panel, rendered in two flavors:
	* - desktop (≥md): inline aside that slides in from the right
	* - mobile (<md): fixed-position aside + scrim overlay
	*
	* Both surfaces share the same `<SettingsPanel>` body. The mobile
	* overlay also gets a click-to-dismiss scrim so the user can close
	* by tapping outside the panel.
	*/
export function ChatSettingsPanel({
	paramsOpen,
	setParamsOpen,
	temperature,
	setTemperature,
	topP,
	setTopP,
	maxTokens,
	setMaxTokens,
	topK,
	setTopK,
	freqPenalty,
	setFreqPenalty,
	presPenalty,
	setPresPenalty,
	stream,
	setStream,
	showAdvanced,
	setShowAdvanced,
	model,
}: ChatSettingsPanelProps) {
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
								<LazySettingsPanel
									temperature={temperature}
									setTemperature={setTemperature}
									topP={topP}
									setTopP={setTopP}
									maxTokens={maxTokens}
									setMaxTokens={setMaxTokens}
									topK={topK}
									setTopK={setTopK}
									freqPenalty={freqPenalty}
									setFreqPenalty={setFreqPenalty}
									presPenalty={presPenalty}
									setPresPenalty={setPresPenalty}
									stream={stream}
									setStream={setStream}
									showAdvanced={showAdvanced}
									setShowAdvanced={setShowAdvanced}
									model={model}
								/>
							</div>
						</div>
					</m.aside>
				)}
			</AnimatePresence>

			{/* Mobile Settings Modal Overlay */}
			<AnimatePresence>
				{paramsOpen && (
					<m.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="md:hidden fixed inset-0 z-40 bg-overlay/80 backdrop-blur-sm"
						onClick={() => setParamsOpen(false)}
					/>
				)}
			</AnimatePresence>

			{/* Mobile Settings Panel */}
			<AnimatePresence>
				{paramsOpen && (
					<m.aside
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={springs.card}
						className="md:hidden fixed inset-y-0 right-0 w-80 bg-void border-l border-border z-50 flex flex-col"
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
							<LazySettingsPanel
								temperature={temperature}
								setTemperature={setTemperature}
								topP={topP}
								setTopP={setTopP}
								maxTokens={maxTokens}
								setMaxTokens={setMaxTokens}
								topK={topK}
								setTopK={setTopK}
								freqPenalty={freqPenalty}
								setFreqPenalty={setFreqPenalty}
								presPenalty={presPenalty}
								setPresPenalty={setPresPenalty}
								stream={stream}
								setStream={setStream}
								showAdvanced={showAdvanced}
								setShowAdvanced={setShowAdvanced}
								model={model}
							/>
						</div>
					</m.aside>
				)}
			</AnimatePresence>
		</>
	);
}
