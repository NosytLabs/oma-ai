'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { MODELS } from './ChatMessage'

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
        <label className="text-xs font-medium text-zinc-400">{label}</label>
        <span className="text-xs font-mono text-accent">{displayValue ?? value.toFixed(step < 0.1 ? 2 : 1)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-accent"
      />
    </div>
  )
}

function MCPConnector() {
  const [expanded, setExpanded] = useState(false)

  const detectMCP = () => {
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('claude') || ua.includes('cursor') || ua.includes('windsurf')) {
      return 'detected'
    }
    return 'not_detected'
  }

  const status = detectMCP()

  return (
    <div className="pt-4 border-t border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex items-center justify-between w-full text-xs font-medium text-zinc-400 hover:text-accent transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${status === 'detected' ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
          MCP Connectors
        </span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 space-y-3 overflow-hidden"
          >
            <div className="p-3 bg-surface border border-border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-text">TinyFish</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${status === 'detected' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-500'}`}>
                  {status === 'detected' ? 'Connected' : 'Not connected'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mb-3">
                Connect TinyFish MCP to access OMA from Claude Code, Cursor, and other MCP clients.
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('npx -y install-mcp@latest https://agent.tinyfish.ai/mcp --client claude-code')
                  alert('Install command copied to clipboard!')
                }}
                className="w-full px-3 py-2 bg-accent/10 border border-accent/20 text-accent text-xs font-medium rounded-lg hover:bg-accent/20 transition-colors"
              >
                Copy Install Command
              </button>
              <div className="mt-3 p-2 bg-zinc-900/50 rounded border border-zinc-800">
                <code className="text-xs text-zinc-400 break-all">
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
  const selectedModel = MODELS.find(m => m.id === model)

  return (
    <div className="space-y-5">
      <Slider label="Temperature" value={temperature} onChange={setTemperature} min={0} max={2} step={0.1} />
      <Slider label="Top P" value={topP} onChange={setTopP} min={0} max={1} step={0.05} />
      <Slider label="Frequency Penalty" value={freqPenalty} onChange={setFreqPenalty} min={-2} max={2} step={0.1} />
      <Slider label="Presence Penalty" value={presPenalty} onChange={setPresPenalty} min={-2} max={2} step={0.1} />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-400">Max Tokens</label>
          <span className="text-xs font-mono text-accent">{maxTokens}</span>
        </div>
        <input
          type="number"
          value={maxTokens}
          onChange={(e) => setMaxTokens(Math.max(1, Math.min(32000, parseInt(e.target.value) || 2048)))}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm font-mono focus:border-accent"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-400">Top K</label>
          <span className="text-xs font-mono text-accent">{topK}</span>
        </div>
        <input
          type="number"
          value={topK}
          onChange={(e) => setTopK(Math.max(1, Math.min(100, parseInt(e.target.value) || 40)))}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm font-mono focus:border-accent"
        />
      </div>

      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        aria-expanded={showAdvanced}
        className="flex items-center gap-2 text-xs text-zinc-500 hover:text-accent transition-colors"
      >
        {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {showAdvanced ? 'Hide' : 'Show'} advanced
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
              <label className="text-xs font-medium text-zinc-400">Stream responses</label>
              <button
                onClick={() => setStream(!stream)}
                role="switch"
                aria-checked={stream}
                aria-label="Stream responses"
                className={`relative w-10 h-5 rounded-full transition-colors ${stream ? 'bg-accent' : 'bg-zinc-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${stream ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedModel && (
        <div className="pt-4 border-t border-border">
          <div className="text-xs text-zinc-500 mb-2">Model pricing (per 1M tokens)</div>
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Input</span>
            <span className="text-accent font-mono">${selectedModel.inputPer1M.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-zinc-400">Output</span>
            <span className="text-secondary font-mono">${selectedModel.outputPer1M.toFixed(2)}</span>
          </div>
        </div>
      )}

      <MCPConnector />
    </div>
  )
}