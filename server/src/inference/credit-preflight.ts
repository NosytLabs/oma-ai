import { estimateTokens } from "./models.js";
import { refundCredits } from "../credits/index.js";
import { logger } from "../lib/logger.js";
import type { ChatMessage } from "./types.js";

export function countMessageTokens(messages: ChatMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      total += estimateTokens(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text" && typeof part.text === "string") total += estimateTokens(part.text);
      }
    }
  }
  return total;
}

export async function refundCreditsWithRetry(userId: string, amount: string, requestId?: string, retries = 3): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await refundCredits(userId, amount, requestId);
      return;
    } catch (err) {
      if (attempt === retries) {
        logger.error({ err, userId, amount, requestId, attempts: retries }, "[router] Refund credits failed");
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100 * attempt));
    }
  }
}
