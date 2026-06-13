export type MessageContent = string | Array<{ type: string; text?: string; image_url?: { url: string } }>;

export interface ChatMessage {
  role: string;
  content: MessageContent;
}

export interface ModelPricing {
  inputPer1k: number
  outputPer1k: number
  provider: 'venice' | 'antseed' | 'litellm' | 'openrouter' | 'together' | 'deepinfra' | 'surplus' | 'morpheus'
  markup: number
}
