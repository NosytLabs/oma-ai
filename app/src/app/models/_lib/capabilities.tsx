// Shared capability metadata used by /models listing and /models/[slug] detail.
// Lives in a non-`'use client'` module so server components (the detail page)
// can import the icon map without dragging the listing page's client bundle.

import {
  Brain, Code, Eye, Zap as ZapIcon,
  Cpu, Hash,
} from 'lucide-react'
import type { Capability } from '@/lib/models-data'

const ICON_PROPS = { strokeWidth: 1.5 } as const

export const CAPABILITY_ICONS: Record<Capability, React.ReactNode> = {
  reasoning: <Brain className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
  coding: <Code className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
  multimodal: <Eye className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
  vision: <Eye className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
  fast: <ZapIcon className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
  uncensored: <Cpu className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
  agents: <Cpu className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
  math: <Hash className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
  chat: <Brain className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
}

export const CAPABILITY_LABELS: Record<Capability, string> = {
  reasoning: 'Reasoning',
  coding: 'Coding',
  multimodal: 'Multimodal',
  vision: 'Vision',
  fast: 'Fast',
  uncensored: 'Uncensored',
  agents: 'Agents',
  math: 'Math',
  chat: 'Chat',
}

/** Human-readable descriptions for each capability, shown as native
 *  browser tooltips (title attr) on chips. Keeps the vocabulary
 *  consistent across /models listing, /models/[slug] detail, and
 *  any future surface that renders capability badges. */
export const CAPABILITY_DESCRIPTIONS: Record<Capability, string> = {
  reasoning: 'Extended chain-of-thought, math proofs, multi-step planning',
  coding: 'Code generation, refactoring, and code review across languages',
  multimodal: 'Accepts images, audio, or video alongside text',
  vision: 'Can read and analyze images you attach to the prompt',
  fast: 'Lower-latency model suited for short, interactive turns',
  uncensored: 'No content-policy refusal layer — user is responsible for outputs',
  agents: 'Tuned for tool use, function calling, and multi-step agent loops',
  math: 'Strong arithmetic, symbolic math, and formal reasoning',
  chat: 'General-purpose conversational model',
}
