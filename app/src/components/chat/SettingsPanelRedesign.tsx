'use client'

/**
 * SETTINGS PANEL REDESIGN — "Terminal Noir" Aesthetic
 * 
 * Key changes:
 * - Sliders use custom styled tracks with gradient fills
 * - Section dividers use animated gradient lines
 * - Toggle switch has a glow effect when active
 * - Input fields have subtle inner shadow for depth
 * - Pricing section uses a glassmorphism card
 * - MCP section has a terminal-style status indicator
 */

import { useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useLiveModels } from './chat-message-shared'

interface SettingsPanelProps {
  temperature: number
  setTemperature: (t: number) => void
  topP: number
  setTopP: (t: number) => void
  maxTokens: number
  setMaxTokens: (t: number) => void
  topK: number
  setTopK: (t: number) => void
  freqPenalty: number
  setFreqPenalty: (t: number) => void
  presPenalty: number
  setPresPenalty: (t: number) => void
  stream: boolean
  setStream: (s: boolean) => void
  showAdvanced: boolean
  setShowAdvanced: (s: boolean) => void
  model: string
}

// ═══════════════════════════════════════════════════════════════════
// CUSTOM SLIDER — Gradient track with glow thumb
// ═══════════════════════════════════════════════════════════════════

function Slider({ label, value, onChange, min, max, step, displayValue }: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  displayValue?: string
}) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-mono text-text-muted uppercase tracking-wider">
          {label}
        </label>
        <span className="text-xs font-mono text-success tabular-nums">
          {displayValue ?? value.toFixed(step < 0.1 ? 2 : 1)}
        </span>
      </div>
      <div className="relative">
        {/* Track background */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-surface-elevated rounded-full overflow-hidden">
          {/* Filled portion */}
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, var(--color-success), var(--color-accent))`,
              boxShadow: '0 0 8px var(--color-accent-glow)',
            }}
          />
        </div>
        {/* Native input */}
        <input
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
            [&::-webkit-slider-thumb]:bg-accent
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-void
            [&::-webkit-slider-thumb]:shadow-[0_0_8px_var(--color-accent-glow)]
            [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-150
            [&::-webkit-slider-thumb]:hover:scale-125
            [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5
            [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent
            [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-void
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
            focus-visible:ring-offset-2 focus-visible:ring-offset-void
          "
        />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// GLOWING TOGGLE — Active state has ambient glow
// ═══════════════════════════════════════════════════════════════════

function GlowToggle({ checked, onChange, label }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs font-mono text-text-muted uppercase tracking-wider">{label}</label>
      <button type="button"
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`
          relative w-10 h-5 rounded-full transition-all duration-300
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          focus-visible:ring-offset-2 focus-visible:ring-offset-void
          ${checked
            ? 'bg-success shadow-[0_0_12px_rgba(52,211,153,0.3)]'
            : 'bg-surface-elevated'
          }
        `}
      >
        <m.span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-text-inverse"
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// SECTION DIVIDER — Animated gradient line
// ═══════════════════════════════════════════════════════════════════

function SectionDivider() {
  return (
    <div
      className="h-px my-1"
      style={{
        background: 'linear-gradient(90deg, transparent, var(--color-border), var(--color-accent-dim), var(--color-border), transparent)',
      }}
    />
  )
}

// ═══════════════════════════════════════════════════════════════════
// MCP CONNECTOR — Terminal-style status display
// ═══════════════════════════════════════════════════════════════════

function MCPConnector() {
  const [expanded, setExpanded] = useState(false)
  const toast = useToast()

  return (
    <div className="pt-3 border-t border-border/50">
      <button type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="
          flex items-center justify-between w-full text-[10px] font-mono
          text-text-muted hover:text-text-muted uppercase tracking-wider
          transition-colors
        "
      >
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-surface-elevated animate-pulse" />
          MCP
        </span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 space-y-3 overflow-hidden"
          >
            <div className="p-3 bg-void/80 border border-border/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-text-secondary">TINYFISH</span>
                <span className="text-[10px] px-1.5 py-0.5 font-mono uppercase bg-surface-elevated/50 text-text-muted border border-border/50">
                  NOT DETECTED
                </span>
              </div>
              <p className="text-[10px] text-text-muted font-mono mb-3">
                Connect TinyFish MCP to access OMA from Claude Code, Cursor, and other MCP clients.
              </p>
              <button type="button"
                onClick={() => {
                  navigator.clipboard.writeText('npx -y install-mcp@latest https://agent.tinyfish.ai/mcp --client claude-code')
                  toast.success('Install command copied!')
                }}
                className="
                  w-full px-3 py-2 bg-surface border border-border text-text-muted text-xs font-mono
                  hover:brightness-150 hover:border-accent/30 transition-all duration-200
                "
              >
                COPY INSTALL CMD
              </button>
              <div className="mt-3 p-2 bg-void rounded border border-border/50">
                <code className="text-[10px] text-text-muted font-mono break-all">
                  npx -y install-mcp@latest https://agent.tinyfish.ai/mcp --client claude-code
                </code>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SETTINGS PANEL
// ═══════════════════════════════════════════════════════════════════

export function SettingsPanel({
  temperature, setTemperature,
  topP, setTopP,
  maxTokens, setMaxTokens,
  topK, setTopK,
  freqPenalty, setFreqPenalty,
  presPenalty, setPresPenalty,
  stream, setStream,
  showAdvanced, setShowAdvanced,
  model,
}: SettingsPanelProps) {
  const MODELS = useLiveModels()
  const selectedModel = MODELS.find(m => m.id === model)

  return (
    <div className="space-y-5 font-mono text-sm">
      {/* ─── Core Parameters ─── */}
      <Slider label="TEMP" value={temperature} onChange={setTemperature} min={0} max={2} step={0.1} />
      <Slider label="TOP_P" value={topP} onChange={setTopP} min={0} max={1} step={0.05} />
      <Slider label="FREQ_PEN" value={freqPenalty} onChange={setFreqPenalty} min={-2} max={2} step={0.1} />
      <Slider label="PRES_PEN" value={presPenalty} onChange={setPresPenalty} min={-2} max={2} step={0.1} />

      <SectionDivider />

      {/* ─── Token Controls ─── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono text-text-muted uppercase tracking-wider">MAX_TOK</label>
          <span className="text-xs font-mono text-success tabular-nums">{maxTokens}</span>
        </div>
        <input
          type="number"
          value={maxTokens}
          onChange={(e) => setMaxTokens(Math.max(1, Math.min(32000, parseInt(e.target.value, 10) || 2048)))}
          aria-label="Max tokens"
          className="
            w-full px-3 py-2 bg-void border border-border text-sm font-mono text-text-secondary
            focus:border-accent focus:ring-1 focus:ring-accent/20
            transition-all duration-200
          "
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono text-text-muted uppercase tracking-wider">TOP_K</label>
          <span className="text-xs font-mono text-success tabular-nums">{topK}</span>
        </div>
        <input
          type="number"
          value={topK}
          onChange={(e) => setTopK(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 40)))}
          aria-label="Top K"
          className="
            w-full px-3 py-2 bg-void border border-border text-sm font-mono text-text-secondary
            focus:border-accent focus:ring-1 focus:ring-accent/20
            transition-all duration-200
          "
        />
      </div>

      <SectionDivider />

      {/* ─── Advanced Toggle ─── */}
      <button type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        aria-expanded={showAdvanced}
        className="
          flex items-center gap-2 text-[10px] font-mono text-text-muted
          hover:text-text-secondary uppercase tracking-wider transition-colors
        "
      >
        {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {showAdvanced ? '-HIDE' : '+SHOW'} ADVANCED
      </button>

      <AnimatePresence>
        {showAdvanced && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-4 overflow-hidden"
          >
            <GlowToggle
              checked={stream}
              onChange={setStream}
              label="STREAM"
            />
          </m.div>
        )}
      </AnimatePresence>

      {/* ─── Model Pricing Card ─── */}
      {selectedModel && (
        <div className="pt-3 border-t border-border/50">
          <div className="p-3 bg-void/60 border border-border/40 backdrop-blur-sm">
            <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-2">
              MODEL PRICING (PER 1M TOKENS)
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-text-muted">INPUT</span>
              <span className="text-success tabular-nums">${selectedModel.inputPer1M.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs font-mono mt-1">
              <span className="text-text-muted">OUTPUT</span>
              <span className="text-text-muted tabular-nums">${selectedModel.outputPer1M.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      <MCPConnector />
    </div>
  )
}
