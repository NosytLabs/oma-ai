"use client";

/**
 * SETTINGS PANEL REDESIGN — "Terminal Noir" Aesthetic
 *
 * Key changes:
 * - Sliders use custom styled tracks with gradient fills
 * - Section dividers use animated gradient lines
 * - Toggle switch has a glow effect when active
 * - Input fields have subtle inner shadow for depth
 * - Pricing section uses a glassmorphism card
 * - Agents section links OpenCode / Claude Code / Cursor base-URL setup
 */

import { copyToClipboard } from "@/lib/clipboard";
import { AnimatePresence, m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, useId } from "react";
import { useToast } from "@/components/ui/Toast";
import { useSharedLiveModels } from "./chat-message-shared";

interface SettingsPanelProps {
	temperature: number;
	setTemperature: (t: number) => void;
	topP: number;
	setTopP: (t: number) => void;
	maxTokens: number;
	setMaxTokens: (t: number) => void;
	topK: number;
	setTopK: (t: number) => void;
	freqPenalty: number;
	setFreqPenalty: (t: number) => void;
	presPenalty: number;
	setPresPenalty: (t: number) => void;
	stream: boolean;
	setStream: (s: boolean) => void;
	showAdvanced: boolean;
	setShowAdvanced: (s: boolean) => void;
	model: string;
}

// ═══════════════════════════════════════════════════════════════════
// CUSTOM SLIDER — Gradient track with glow thumb
// ═══════════════════════════════════════════════════════════════════

function Slider({
	label,
	value,
	onChange,
	min,
	max,
	step,
	displayValue,
}: {
	label: string;
	value: number;
	onChange: (v: number) => void;
	min: number;
	max: number;
	step: number;
	displayValue?: string;
}) {
	const pct = ((value - min) / (max - min)) * 100;
	const inputId = useId();

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<label htmlFor={inputId} className="text-xs font-mono text-text-muted uppercase tracking-wider">
					{label}
				</label>
				<span className="text-xs font-mono text-[var(--color-success)] tabular-nums">
					{displayValue ?? value.toFixed(step < 0.1 ? 2 : 1)}
				</span>
			</div>
			<div className="relative">
				{/* Track background */}
				<div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-[var(--color-surface-elevated)] rounded-full overflow-hidden">
					{/* Filled portion */}
					<div
						className="h-full rounded-full transition-[width] duration-200 ease-out"
						style={{
							width: `${pct}%`,
							background: `linear-gradient(90deg, var(--color-success), var(--color-accent))`,
							boxShadow: "0 0 8px var(--color-accent-glow)",
						}}
					/>
				</div>
				{/* Native input */}
				<input
					id={inputId}
					type="range"
					min={min}
					max={max}
					step={step}
					value={value}
					onChange={(e) => onChange(parseFloat(e.target.value))}
					className="w-full h-1 bg-transparent appearance-none cursor-pointer relative z-10
 [&::-webkit-slider-thumb]:appearance-none
 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
 [&::-webkit-slider-thumb]:rounded-full
 [&::-webkit-slider-thumb]:bg-[var(--color-accent)]
 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--color-void)]
 [&::-webkit-slider-thumb]:shadow-[0_0_8px_var(--color-accent-glow)]
 [&::-webkit-slider-thumb]:transition-[transform] [&::-webkit-slider-thumb]:duration-200 [&::-webkit-slider-thumb]:ease-out
 [&::-webkit-slider-thumb]:hover:scale-125
 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5
 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[var(--color-accent)]
 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[var(--color-void)]
 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]
 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]
 "
				/>
			</div>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════
// GLOWING TOGGLE — Active state has ambient glow
// ═══════════════════════════════════════════════════════════════════

function GlowToggle({
	checked,
	onChange,
	label,
}: {
	checked: boolean;
	onChange: (v: boolean) => void;
	label: string;
}) {
	const labelId = useId();
	return (
		<div className="flex items-center justify-between">
			<label
				id={labelId}
				className="text-xs font-mono text-text-muted uppercase tracking-wider"
			>
				{label}
			</label>
			<button
				type="button"
				onClick={() => onChange(!checked)}
				role="switch"
				aria-checked={checked}
				aria-labelledby={labelId}
				className={`
 relative w-10 h-5 rounded-full transition-[background-color,box-shadow] duration-200 ease-out
 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]
 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]
 ${
						checked
							? "bg-[var(--color-success)] shadow-[0_0_12px_var(--color-success-glow)]"
							: "bg-[var(--color-surface-elevated)]"
					}
 `}
			>
				<m.span
					className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[var(--color-void)]"
					animate={{ x: checked ? 20 : 0 }}
					transition={springs.tab}
				/>
			</button>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════
// SECTION DIVIDER — Animated gradient line
// ═══════════════════════════════════════════════════════════════════

function SectionDivider() {
	return (
		<div
			className="h-px my-1"
			style={{
				background:
					"linear-gradient(90deg, transparent, var(--color-border), var(--color-accent-dim), var(--color-border), transparent)",
			}}
		/>
	);
}

// ═══════════════════════════════════════════════════════════════════
// AGENTS CONNECTOR — OpenAI-compatible base URL for CLIs / IDEs
// ═══════════════════════════════════════════════════════════════════

const AGENT_ENV_SNIPPET = `export OPENAI_API_KEY="oma_sk_your_key_here"
export OPENAI_BASE_URL="https://api.oma-ai.com/v1"`;

function AgentsConnector() {
	const [expanded, setExpanded] = useState(false);
	const toast = useToast();

	return (
		<div className="pt-3 border-t border-[var(--color-border)]/50">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				aria-expanded={expanded}
				className="
 flex items-center justify-between w-full text-[10px] font-mono
 text-text-muted hover:text-text-secondary uppercase tracking-wider
 transition-colors duration-200 ease-out active:scale-[0.97] focus-ring
						"
			>
				<span className="flex items-center gap-2">
					<span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]/70" aria-hidden="true" />
					Agents &amp; IDEs
				</span>
				{expanded ? (
					<ChevronUp className="w-3 h-3" />
				) : (
					<ChevronDown className="w-3 h-3" />
				)}
			</button>

			<AnimatePresence>
				{expanded && (
					<m.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={springs.soft}
						className="mt-3 space-y-3 overflow-hidden"
					>
						<div className="p-3 bg-[var(--color-void)]/80 border border-[var(--color-border)]/50 backdrop-blur-sm rounded-[var(--radius-md)]">
							<div className="flex items-center gap-2 mb-2">
								<span className="text-xs font-mono text-text-secondary">
									OPENAI-COMPATIBLE
								</span>
								<span className="text-[10px] px-1.5 py-0.5 font-mono uppercase bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-[var(--color-success)] border border-[color-mix(in_srgb,var(--color-success)_30%,transparent)] rounded-[var(--radius-sm)]">
									Live
								</span>
							</div>
							<p className="text-[10px] text-text-muted font-mono mb-3 leading-relaxed">
								Point OpenCode, Claude Code, Cursor, or any OpenAI client at
								api.oma-ai.com/v1 with an oma_sk_ key from the dashboard.
							</p>
							<button
								type="button"
								onClick={() => {
									void copyToClipboard(AGENT_ENV_SNIPPET).then((ok) => {
										if (ok) toast.success("Env snippet copied");
										else toast.error("Couldn't copy to clipboard");
									});
								}}
								className="
 w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-text-secondary text-xs font-mono
 hover:border-[var(--color-accent)]/40 hover:text-text-bright hover:bg-[color-mix(in_srgb,var(--color-accent)_5%,transparent)] transition-[border-color,color,background-color,transform] duration-200 ease-out active:scale-[0.97] focus-ring
 "
							>
								COPY ENV SNIPPET
							</button>
							<div className="mt-3 p-2 bg-[var(--color-void)] rounded-[var(--radius-md)] border border-[var(--color-border)]/50">
								<code className="text-[10px] text-text-muted font-mono break-all whitespace-pre-wrap">
									{AGENT_ENV_SNIPPET}
								</code>
							</div>
							<div className="mt-3 flex flex-wrap gap-2">
								<a
									href="/docs#integrations"
									className="text-[10px] font-mono text-[var(--color-accent)] hover:underline underline-offset-2"
								>
									Docs · integrations
								</a>
								<a
									href="/agent-skill.md"
									className="text-[10px] font-mono text-[var(--color-accent)] hover:underline underline-offset-2"
									target="_blank"
									rel="noreferrer"
								>
									Agent skill file
								</a>
							</div>
						</div>
					</m.div>
				)}
			</AnimatePresence>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SETTINGS PANEL
// ═══════════════════════════════════════════════════════════════════

export function SettingsPanel({
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
}: SettingsPanelProps) {
	const MODELS = useSharedLiveModels();
	const selectedModel = MODELS.find((m) => m.id === model);

	return (
		<div className="space-y-5 font-mono text-sm">
			{/* ─── Core Parameters ─── */}
			<Slider
				label="Temperature"
				value={temperature}
				onChange={setTemperature}
				min={0}
				max={2}
				step={0.1}
			/>
			<Slider
				label="TOP_P"
				value={topP}
				onChange={setTopP}
				min={0}
				max={1}
				step={0.05}
			/>
			<Slider
				label="FREQ_PEN"
				value={freqPenalty}
				onChange={setFreqPenalty}
				min={-2}
				max={2}
				step={0.1}
			/>
			<Slider
				label="PRES_PEN"
				value={presPenalty}
				onChange={setPresPenalty}
				min={-2}
				max={2}
				step={0.1}
			/>

			<SectionDivider />

			{/* ─── Token Controls ─── */}
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<label className="text-xs font-mono text-text-muted uppercase tracking-wider">
						MAX_TOK
					</label>
					<span className="text-xs font-mono text-success tabular-nums">
						{maxTokens}
					</span>
				</div>
				<input
					type="number"
					value={maxTokens}
					onChange={(e) =>
						setMaxTokens(
							Math.max(
								1,
								Math.min(32000, parseInt(e.target.value, 10) || 2048),
							),
						)
					}
					aria-label="Max tokens"
					className="
 w-full px-3 py-2 bg-[var(--color-void)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-sm font-mono text-text-secondary
 focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/20
 transition-[border-color,box-shadow] duration-200 ease-out
 "
				/>
			</div>

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<label className="text-xs font-mono text-text-muted uppercase tracking-wider">
						TOP_K
					</label>
					<span className="text-xs font-mono text-success tabular-nums">
						{topK}
					</span>
				</div>
				<input
					type="number"
					value={topK}
					onChange={(e) =>
						setTopK(
							Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 40)),
						)
					}
					aria-label="Top K"
					className="
 w-full px-3 py-2 bg-[var(--color-void)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-sm font-mono text-text-secondary
 focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/20
 transition-[border-color,box-shadow] duration-200 ease-out
 "
				/>
			</div>

			<SectionDivider />

			{/* ─── Advanced Toggle ─── */}
			<button
				type="button"
				onClick={() => setShowAdvanced(!showAdvanced)}
				aria-expanded={showAdvanced}
				className="
 flex items-center gap-2 text-[10px] font-mono text-text-muted
 hover:text-text-secondary uppercase tracking-wider transition-colors duration-200 ease-out active:scale-[0.97] focus-ring
				"
			>
				{showAdvanced ? (
					<ChevronUp className="w-3 h-3" />
				) : (
					<ChevronDown className="w-3 h-3" />
				)}
				{showAdvanced ? "-HIDE" : "+SHOW"} ADVANCED
			</button>

			<AnimatePresence>
				{showAdvanced && (
					<m.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={springs.soft}
						className="space-y-4 overflow-hidden"
					>
						<GlowToggle checked={stream} onChange={setStream} label="STREAM" />
					</m.div>
				)}
			</AnimatePresence>

			{/* ─── Model Pricing Card ─── */}
			{selectedModel && (
				<div className="pt-3 border-t border-[var(--color-border)]/50">
					<div className="p-3 bg-[var(--color-void)]/60 border border-[var(--color-border)]/40 rounded-[var(--radius-md)] backdrop-blur-sm">
						<div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-2">
							MODEL PRICING (PER 1M TOKENS)
						</div>
						<div className="flex justify-between text-xs font-mono">
							<span className="text-text-muted">INPUT</span>
							<span className="text-[var(--color-success)] tabular-nums">
								${selectedModel.inputPer1M.toFixed(2)}
							</span>
						</div>
						<div className="flex justify-between text-xs font-mono mt-1">
							<span className="text-text-muted">OUTPUT</span>
							<span className="text-text-muted tabular-nums">
								${selectedModel.outputPer1M.toFixed(2)}
							</span>
						</div>
					</div>
				</div>
			)}

			<AgentsConnector />
		</div>
	);
}
