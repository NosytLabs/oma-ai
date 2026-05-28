import { db } from '../db/client.js';
import { usageRecords } from '../db/schema.js';

export interface UsageRecordParams {
  requestId: string;
  userId: string;
  apiKeyId: string;
  modelId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costCents: string;
  markupCents: string;
  totalCents: string;
}

export async function recordUsage(params: UsageRecordParams): Promise<void> {
  await db.insert(usageRecords).values({
    requestId: params.requestId,
    userId: params.userId,
    apiKeyId: params.apiKeyId,
    model: params.modelId,
    provider: params.provider as "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra",
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    costCents: params.costCents,
    markupCents: params.markupCents,
    totalCents: params.totalCents,
  }).onConflictDoNothing();
}

export async function recordUsageFromBilling(
  params: UsageRecordParams
): Promise<void> {
  return recordUsage(params);
}