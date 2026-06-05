import { Context } from 'hono';

export function createInsufficientCreditsPayReq(c: Context, required: number, balance: number) {
  return c.json({
    error: {
      message: `Insufficient credits. Required: ${required}, Balance: ${balance}`,
      type: 'insufficient_credits',
      code: 'insufficient_credits',
    }
  }, 402);
}
