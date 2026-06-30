export type Tier = 'budget' | 'mid' | 'premium' | 'frontier'
export type Provider = 'Venice' | 'AntSeed' | 'Claude' | 'Gemini' | 'OpenRouter' | 'Together'

export interface Model {
  id: string
  name: string
  provider: Provider
  tier: Tier
  description: string
  contextLength: string
  inputPricePer1M: number
  outputPricePer1M: number
  capabilities: Capability[]
  modelId: string
}

export type Capability =
  | 'reasoning'
  | 'coding'
  | 'multimodal'
  | 'vision'
  | 'fast'
  | 'uncensored'
  | 'agents'
  | 'math'
  | 'chat'

export const PROVIDER_COLORS: Record<Provider, { bg: string; text: string; border: string }> = {
  Venice: { bg: 'bg-violet/20', text: 'text-violet', border: 'border-violet/30' },
  AntSeed: { bg: 'bg-success/20', text: 'text-success', border: 'border-success/30' },
  Claude: { bg: 'bg-warning/20', text: 'text-warning', border: 'border-warning/30' },
  Gemini: { bg: 'bg-accent/20', text: 'text-accent', border: 'border-accent/30' },
  OpenRouter: { bg: 'bg-text-secondary/20', text: 'text-text-secondary', border: 'border-text-secondary/30' },
  Together: { bg: 'bg-tertiary/20', text: 'text-tertiary', border: 'border-tertiary/30' },
}

export const TIER_COLORS: Record<Tier, { bg: string; text: string; border: string; badge: string }> = {
  budget: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30', badge: 'bg-warning/20 text-warning' },
  mid: { bg: 'bg-accent/10', text: 'text-accent', border: 'border-accent/30', badge: 'bg-accent/20 text-accent' },
  premium: { bg: 'bg-violet/10', text: 'text-violet', border: 'border-violet/30', badge: 'bg-violet/20 text-violet' },
  frontier: { bg: 'bg-violet/10', text: 'text-violet', border: 'border-violet/30', badge: 'bg-violet/20 text-violet' },
}

export const TIER_ORDER: Tier[] = ['budget', 'mid', 'premium', 'frontier']

// ponytail: this exists — source of truth is server/src/inference/models.ts FALLBACK_MODELS.
// Only the 17 chat/text models are listed here; the 2 video models live in
// app/src/app/video-generation/page.tsx (only place they are shown in UI).
export const MODELS: Model[] = [
  {
    id: 'deepseek-v3.2',
    name: 'DeepSeek V3.2',
    provider: 'Venice',
    tier: 'premium',
    description: "DeepSeek's latest flagship model",
    contextLength: '64K',
    inputPricePer1M: 0.50,
    outputPricePer1M: 1.50,
    capabilities: ['chat', 'coding', 'reasoning'],
    modelId: 'deepseek-v3.2',
  },
  {
    id: 'llama-3.3-70b',
    name: 'Llama 3.3 70B',
    provider: 'Venice',
    tier: 'mid',
    description: "Meta's latest 70B model",
    contextLength: '8K',
    inputPricePer1M: 0.35,
    outputPricePer1M: 0.90,
    capabilities: ['chat', 'coding'],
    modelId: 'llama-3.3-70b',
  },
  {
    id: 'llama-3.2-3b',
    name: 'Llama 3.2 3B',
    provider: 'Venice',
    tier: 'budget',
    description: 'Fast, lightweight model',
    contextLength: '8K',
    inputPricePer1M: 0.06,
    outputPricePer1M: 0.12,
    capabilities: ['chat', 'fast'],
    modelId: 'llama-3.2-3b',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenRouter',
    tier: 'mid',
    description: "OpenAI's cost-efficient model",
    contextLength: '128K',
    inputPricePer1M: 0.15,
    outputPricePer1M: 0.60,
    capabilities: ['chat', 'coding', 'reasoning'],
    modelId: 'gpt-4o-mini',
  },
  {
    id: 'llama-3.3-70b-together',
    name: 'Llama 3.3 70B (Together)',
    provider: 'Together',
    tier: 'premium',
    description: "Meta's 70B on Together AI",
    contextLength: '8K',
    inputPricePer1M: 0.35,
    outputPricePer1M: 0.90,
    capabilities: ['chat', 'coding'],
    modelId: 'llama-3.3-70b-together',
  },
  {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet',
    provider: 'Claude',
    tier: 'frontier',
    description: 'Anthropic Claude 3.5 Sonnet — best-in-class reasoning and code',
    contextLength: '200K',
    inputPricePer1M: 3.00,
    outputPricePer1M: 15.00,
    capabilities: ['chat', 'coding', 'reasoning', 'agents'],
    modelId: 'claude-3-5-sonnet-latest',
  },
  {
    id: 'claude-3-5-haiku-latest',
    name: 'Claude 3.5 Haiku',
    provider: 'Claude',
    tier: 'mid',
    description: 'Anthropic Claude 3.5 Haiku — fast, cost-efficient',
    contextLength: '200K',
    inputPricePer1M: 0.80,
    outputPricePer1M: 4.00,
    capabilities: ['chat', 'coding', 'fast'],
    modelId: 'claude-3-5-haiku-latest',
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'Claude',
    tier: 'frontier',
    description: 'Anthropic Claude Sonnet 4 — frontier reasoning',
    contextLength: '200K',
    inputPricePer1M: 3.00,
    outputPricePer1M: 15.00,
    capabilities: ['chat', 'coding', 'reasoning', 'agents', 'vision'],
    modelId: 'claude-sonnet-4',
  },
  {
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'Claude',
    tier: 'frontier',
    description: 'Anthropic Claude Opus 4 — most capable model',
    contextLength: '200K',
    inputPricePer1M: 15.00,
    outputPricePer1M: 75.00,
    capabilities: ['chat', 'coding', 'reasoning', 'agents', 'vision'],
    modelId: 'claude-opus-4',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Gemini',
    tier: 'frontier',
    description: 'Google Gemini 2.5 Pro — frontier reasoning, 1M context',
    contextLength: '1M',
    inputPricePer1M: 1.25,
    outputPricePer1M: 10.00,
    capabilities: ['chat', 'coding', 'reasoning', 'agents', 'vision'],
    modelId: 'gemini-2.5-pro',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Gemini',
    tier: 'mid',
    description: 'Google Gemini 2.5 Flash — fast, cost-efficient',
    contextLength: '1M',
    inputPricePer1M: 0.075,
    outputPricePer1M: 0.30,
    capabilities: ['chat', 'coding', 'fast', 'vision'],
    modelId: 'gemini-2.5-flash',
  },
  {
    id: 'gemini-2.5-flash-thinking',
    name: 'Gemini 2.5 Flash (thinking)',
    provider: 'Gemini',
    tier: 'mid',
    description: 'Google Gemini 2.5 Flash with thinking enabled',
    contextLength: '1M',
    inputPricePer1M: 0.075,
    outputPricePer1M: 0.30,
    capabilities: ['chat', 'coding', 'reasoning', 'fast'],
    modelId: 'gemini-2.5-flash-thinking',
  },
  {
    id: 'gemini-2.5-pro-thinking',
    name: 'Gemini 2.5 Pro (thinking)',
    provider: 'Gemini',
    tier: 'frontier',
    description: 'Google Gemini 2.5 Pro with thinking enabled',
    contextLength: '1M',
    inputPricePer1M: 1.25,
    outputPricePer1M: 10.00,
    capabilities: ['chat', 'coding', 'reasoning', 'agents'],
    modelId: 'gemini-2.5-pro-thinking',
  },
]

export function formatPricePerToken(pricePer1M: number): string {
  if (pricePer1M === 0) return '$0.00'
  const perToken = pricePer1M / 1000000
  if (perToken < 0.00001) return '$0.00'
  return `$${perToken.toFixed(6)}`
}

export function getModelsByTier(models: Model[]): Record<Tier, Model[]> {
  const grouped: Record<Tier, Model[]> = {
    budget: [],
    mid: [],
    premium: [],
    frontier: [],
  }
  for (const model of models) {
    grouped[model.tier].push(model)
  }
  return grouped
}

export const MODEL_COUNT = MODELS.length

type FeaturedModelLogo =
  | 'llama'
  | 'claude'
  | 'gemini'
  | 'deepseek'
  | 'gpt'
  | 'venice'
  | 'together'
  | 'antseed'

export function getProviderLogo(provider: Provider): FeaturedModelLogo {
  const logos: Record<Provider, FeaturedModelLogo> = {
    Venice: 'venice',
    AntSeed: 'antseed',
    Claude: 'claude',
    Gemini: 'gemini',
    OpenRouter: 'gpt',
    Together: 'together',
  }
  return logos[provider]
}

/**
 * Returns the URL path for a provider's logo SVG in /public/logos/.
 * Used by Hero and ModelCard for <Image> src attributes.
 */
export function getProviderLogoUrl(provider: Provider): string {
  const logoMap: Record<Provider, string> = {
    Venice: '/logos/venice.svg',
    AntSeed: '/logos/antseed.svg',
    Claude: '/logos/claude.svg',
    Gemini: '/logos/gemini.svg',
    OpenRouter: '/logos/openrouter.svg',
    Together: '/logos/together.svg',
  }
  return logoMap[provider] ?? '/logos/default.svg'
}