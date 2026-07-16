import { EventEmitter } from "node:events";

/**
 * In-process event bus for live deposit completion.
 * Consumed by the `/v1/deposit/feed` WebSocket to push real-time
 * deposit events to subscribed clients.
 */
export interface DepositEvent {
  id: string;
  userId: string;
  type: string;
  amountUsd: string;
  creditsIssued: string;
  txHash: string | null;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
}

export const depositEvents = new EventEmitter();
// Allow many concurrent WS subscribers.
depositEvents.setMaxListeners(200);

export function emitDepositMatched(deposit: DepositEvent): void {
  depositEvents.emit("deposit.matched", deposit);
}
