'use client'

import dynamic from 'next/dynamic'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

const LazySettingsPanel = dynamic(
  () => import('@/components/playground/SettingsPanel').then(mod => mod.SettingsPanel),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> }
)

type Props = {
  paramsOpen: boolean
  setParamsOpen: (open: boolean) => void
  paramsPanelRef: React.RefObject<HTMLDivElement | null>
  mobileParamsPanelRef: React.RefObject<HTMLDivElement | null>
  temperature: number
  setTemperature: (v: number) => void
  topP: number
  setTopP: (v: number) => void
  maxTokens: number
  setMaxTokens: (v: number) => void
  topK: number
  setTopK: (v: number) => void
  freqPenalty: number
  setFreqPenalty: (v: number) => void
  presPenalty: number
  setPresPenalty: (v: number) => void
  stream: boolean
  setStream: (v: boolean) => void
  showAdvanced: boolean
  setShowAdvanced: (v: boolean) => void
  model: string
}

export function PlaygroundSettingsPanel({
  paramsOpen, setParamsOpen, paramsPanelRef, mobileParamsPanelRef,
  temperature, setTemperature, topP, setTopP, maxTokens, setMaxTokens,
  topK, setTopK, freqPenalty, setFreqPenalty, presPenalty, setPresPenalty,
  stream, setStream, showAdvanced, setShowAdvanced, model
}: Props) {
  const settingsProps = {
    temperature, setTemperature,
    topP, setTopP,
    maxTokens, setMaxTokens,
    topK, setTopK,
    freqPenalty, setFreqPenalty,
    presPenalty, setPresPenalty,
    stream, setStream,
    showAdvanced, setShowAdvanced,
    model
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <AnimatePresence initial={false}>
        {paramsOpen && (
          <motion.aside
            id="model-parameters-panel"
            role="region"
            aria-label="Model parameters"
            ref={paramsPanelRef}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="flex-none bg-[var(--color-void)] border-l border-[var(--color-border)] z-10 overflow-hidden hidden md:flex flex-col"
          >
            <div className="w-80 flex flex-col h-full">
              <div className="flex-none h-12 border-b border-[var(--color-border)] flex items-center justify-between px-4">
                <h2 className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Model Parameters</h2>
                <button
                  type="button"
                  onClick={() => setParamsOpen(false)}
                  aria-label="Close parameters panel"
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-[var(--color-border)] scrollbar-track-transparent">
                <LazySettingsPanel {...settingsProps} />
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile Modal Overlay */}
      <AnimatePresence>
        {paramsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-40 bg-[var(--color-overlay)]/80 backdrop-blur-sm"
            onClick={() => setParamsOpen(false)}
          />
        )}
      </AnimatePresence>
      
      {/* Mobile Settings Panel */}
      <AnimatePresence>
        {paramsOpen && (
          <motion.aside
            id="model-parameters-panel-mobile"
            role="dialog"
            aria-modal="true"
            aria-label="Model parameters"
            ref={mobileParamsPanelRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="md:hidden fixed inset-y-0 right-0 w-80 bg-[var(--color-void)] border-l border-[var(--color-border)] z-50 flex flex-col"
          >
            <div className="flex-none h-12 border-b border-[var(--color-border)] flex items-center justify-between px-4 bg-[var(--color-void)]">
              <h2 className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Parameters</h2>
              <button
                type="button"
                onClick={() => setParamsOpen(false)}
                aria-label="Close parameters panel"
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <LazySettingsPanel {...settingsProps} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
