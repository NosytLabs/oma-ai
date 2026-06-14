'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useLiveModels } from './ChatMessage'

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

interface SliderProps {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  displayValue?: string
}

function Slider({ label, value, onChange, min, max, step, displayValue }: SliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">{label}</label>
        <span className="text-xs font-mono text-[var(--color-success)]">{displayValue ?? value.toFixed(step < 0.1 ? 2 : 1)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-[var(--color-surface)] appearance-none cursor-pointer accent-[var(--color-success)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]"
      />
    </div>
  )
}

function MCPConnector() {
  const [expanded, setExpanded] = useState(false)
  const toast = useToast()

  const detectMCP = useMemo(() => {
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('claude') || ua.includes('cursor') || ua.includes('windsurf')) {
      return 'detected'
    }
    return 'not_detected'
  }, [])

  const status = detectMCP

  return (
    <div className="pt-3 border-t border-[var(--color-border)]">
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex items-center justify-between w-full text-[10px] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-muted)] uppercase tracking-wider transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${status === 'detected' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-surface-elevated)]'}`} />
          MCP
        </span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 space-y-3 overflow-hidden"
          >
            <div className="p-3 bg-[var(--color-void)] border border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-[var(--color-text-secondary)]">TINYFISH</span>
                <span className={`text-[10px] px-1.5 py-0.5 font-mono uppercase ${status === 'detected' ? 'bg-[var(--color-success-dim)] text-[var(--color-success)]' : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]'}`}>
                  {status === 'detected' ? 'CONNECTED' : 'NOT CONNECTED'}
                </span>
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] font-mono mb-3">
                Connect TinyFish MCP to access OMA from Claude Code, Cursor, and other MCP clients.
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('npx -y install-mcp@latest https://agent.tinyfish.ai/mcp --client claude-code')
                  toast.success('Install command copied!')
                }}
                className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs font-mono hover:brightness-150 transition-colors"
              >
                COPY INSTALL CMD
              </button>
              <div className="mt-3 p-2 bg-[var(--color-void)] rounded border border-[var(--color-border)]">
                <code className="text-[10px] text-[var(--color-text-muted)] font-mono break-all">
                  npx -y install-mcp@latest https://agent.tinyfish.ai/mcp --client claude-code
                </code>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

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
      <Slider label="TEMP" value={temperature} onChange={setTemperature} min={0} max={2} step={0.1} />
      <Slider label="TOP_P" value={topP} onChange={setTopP} min={0} max={1} step={0.05} />
      <Slider label="FREQ_PEN" value={freqPenalty} onChange={setFreqPenalty} min={-2} max={2} step={0.1} />
      <Slider label="PRES_PEN" value={presPenalty} onChange={setPresPenalty} min={-2} max={2} step={0.1} />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">MAX_TOK</label>
          <span className="text-xs font-mono text-[var(--color-success)]">{maxTokens}</span>
        </div>
        <input
          type="number"
          value={maxTokens}
          onChange={(e) => setMaxTokens(Math.max(1, Math.min(32000, parseInt(e.target.value) || 2048)))}
          aria-label="Max tokens"
          className="w-full px-3 py-2 bg-[var(--color-void)] border border-[var(--color-border)] text-sm font-mono text-[var(--color-text-secondary)] focus:border-[var(--color-border)] focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">TOP_K</label>
          <span className="text-xs font-mono text-[var(--color-success)]">{topK}</span>
        </div>
        <input
          type="number"
          value={topK}
          onChange={(e) => setTopK(Math.max(1, Math.min(100, parseInt(e.target.value) || 40)))}
          aria-label="Top K"
          className="w-full px-3 py-2 bg-[var(--color-void)] border border-[var(--color-border)] text-sm font-mono text-[var(--color-text-secondary)] focus:border-[var(--color-border)] focus:outline-none"
        />
      </div>

      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        aria-expanded={showAdvanced}
        className="flex items-center gap-2 text-[10px] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-muted)] uppercase tracking-wider transition-colors"
      >
        {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {showAdvanced ? '-HIDE' : '+SHOW'} ADVANCED
      </button>

      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-4 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">STREAM</label>
              <button
                onClick={() => setStream(!stream)}
                role="switch"
                aria-checked={stream}
                aria-label="Stream responses"
                className={`relative w-9 h-4 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)] ${stream ? 'bg-[var(--color-success)]' : 'bg-[var(--color-surface-elevated)]'}`}
              >
                <span className={`absolute top-0.25 left-0.25 w-3.5 h-3.5 rounded-full bg-[var(--color-text-inverse)] transition-transform ${stream ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedModel && (
        <div className="pt-3 border-t border-[var(--color-border)]">
          <div className="text-[10px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-2">MODEL PRICING (PER 1M TOKENS)</div>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-[var(--color-text-muted)]">INPUT</span>
            <span className="text-[var(--color-success)]">${selectedModel.inputPer1M.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs font-mono mt-1">
            <span className="text-[var(--color-text-muted)]">OUTPUT</span>
            <span className="text-[var(--color-text-muted)]">${selectedModel.outputPer1M.toFixed(2)}</span>
          </div>
        </div>
      )}

      <MCPConnector />
    </div>
  )
}