/**
 * Shared ModelOption type — used by both the live model catalog
 * (components/chat/ChatMessage) and the humanization utilities
 * (lib/model-utils). Living here breaks the lib → components circular
 * dependency that previously existed.
 */
export interface ModelOption {
  id: string
  name: string
  category: 'frontier' | 'premium' | 'mid' | 'budget' | 'reasoning' | 'coding' | 'uncensored'
  provider: 'Venice' | 'AntSeed' | 'Both'
  inputPer1M: number
  outputPer1M: number
  ctx: string
}

export type TierFilter =
  | 'all'
  | 'frontier'
  | 'premium'
  | 'mid'
  | 'budget'
  | 'reasoning'
  | 'coding'
  | 'uncensored'