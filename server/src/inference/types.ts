export type MessageContent = string | Array<{ type: string; text?: string; image_url?: { url: string } }>;

export interface ChatMessage {
  role: string;
  content: MessageContent;
}

export interface InferenceRequest {
  model: string
  messages?: Array<ChatMessage>
  prompt?: string | Array<string>
  input?: string | Array<string>
  temperature?: number
  max_tokens?: number
  stream?: boolean
  timeout?: number
  tools?: Array<Record<string, unknown>>
  response_format?: Record<string, unknown>
}

export interface InferenceResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<Record<string, unknown>>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface ModelPricing {
  inputPer1k: number
  outputPer1k: number
  provider: 'venice' | 'antseed' | 'litellm' | 'openrouter' | 'together' | 'deepinfra' | 'surplus'
  markup: number
}

export interface ProviderHealth {
  provider: string
  circuitOpen: boolean
  lastFailure?: Date
  failureCount: number
}
