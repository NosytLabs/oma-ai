/**
 * ISOLATED Unit Test for server/src/credits/verify-usdc-on-chain.ts
 * Target: server/src/credits/verify-usdc-on-chain.ts
 * Session: ses_flow_audit_2026-06-13T22-32Z
 *
 * **WARNING**: THIS FILE WILL BE DELETED AFTER TEST PASSES
 * Test code preserved in: .opencode/unit-tests/2026-06-13T22-32Z-flow-audit.md
 *
 * Verifies: H-USDC-1 — USDC deposit must verify the on-chain transfer
 * (tx.to === USDC_BASE, value === amountUsd * 1e6, recipient === treasury, status='success')
 * and reject fabricated txHash.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so the factory closure can reference these mocks
const mocks = vi.hoisted(() => ({
  getTransactionReceipt: vi.fn(),
  getTransaction: vi.fn(),
  decodeFunctionData: vi.fn(),
}))

vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    getTransactionReceipt: mocks.getTransactionReceipt,
    getTransaction: mocks.getTransaction,
  })),
  http: vi.fn(),
  fallback: vi.fn((transports: any[]) => transports[0]),
  decodeFunctionData: mocks.decodeFunctionData,
  formatUnits: (v: bigint, d: number) => (Number(v) / 10 ** d).toString(),
  parseAbi: () => [
    { type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }] },
    { type: 'function', name: 'transferFrom', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }] },
  ],
}))

vi.mock('viem/chains', () => ({
  base: { id: 8453, name: 'Base' },
}))

vi.mock('../../lib/rpc-client.js', () => ({
  getPublicClient: vi.fn(() => ({
    getTransactionReceipt: mocks.getTransactionReceipt,
    getTransaction: mocks.getTransaction,
  })),
  resetPublicClient: vi.fn(),
}))

vi.mock('../../config.js', () => ({
  config: {
    CHAIN_RPC_URL: 'https://test-rpc.example.com',
    CHAIN_RPC_URL_FALLBACK: undefined,
    TREASURY_BASE_ADDRESS: '0xTTTTT5555555555555555555555555555555555',
  },
}))

import { verifyUsdcOnChain } from '../verify-usdc-on-chain.js'
import { USDC_BASE } from '../../constants.js'

const VALID_TX_HASH = '0x' + 'a'.repeat(64) as `0x${string}`
const TREASURY = '0xTTTTT5555555555555555555555555555555555'
const USDC = USDC_BASE
const AMOUNT_USD = 100

describe('verifyUsdcOnChain — isolated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getTransactionReceipt.mockReset()
    mocks.getTransaction.mockReset()
    mocks.decodeFunctionData.mockReset()
  })

  it('accepts a real transfer with matching recipient + value', async () => {
    const rawAmount = BigInt(AMOUNT_USD * 10 ** 6)
    mocks.getTransactionReceipt.mockResolvedValue({ status: 'success', blockNumber: 1234n })
    mocks.getTransaction.mockResolvedValue({
      to: USDC, from: '0xSENDER7777777777777777777777777777777777',
      input: '0xTRANSFER_DATA_HEX', value: 0n,
    })
    mocks.decodeFunctionData.mockReturnValue({ functionName: 'transfer', args: [TREASURY, rawAmount] })

    const result = await verifyUsdcOnChain(VALID_TX_HASH, AMOUNT_USD)
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('rejects a fabricated txHash where receipt is not found', async () => {
    mocks.getTransactionReceipt.mockResolvedValue(null)
    const result = await verifyUsdcOnChain(VALID_TX_HASH, AMOUNT_USD)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/not found|failed/i)
  })

  it('rejects a tx where status is reverted', async () => {
    mocks.getTransactionReceipt.mockResolvedValue({ status: 'reverted', blockNumber: 1234n })
    const result = await verifyUsdcOnChain(VALID_TX_HASH, AMOUNT_USD)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/failed|reverted/i)
  })

  it('rejects a tx where recipient is not the treasury', async () => {
    const rawAmount = BigInt(AMOUNT_USD * 10 ** 6)
    mocks.getTransactionReceipt.mockResolvedValue({ status: 'success', blockNumber: 1n })
    mocks.getTransaction.mockResolvedValue({
      to: USDC, from: '0xSENDER7777777777777777777777777777777777',
      input: '0x' + 'a'.repeat(128), value: 0n,
    })
    mocks.decodeFunctionData.mockReturnValue({
      functionName: 'transfer',
      args: ['0xATTACKER0000000000000000000000000000000000', rawAmount],
    })

    const result = await verifyUsdcOnChain(VALID_TX_HASH, AMOUNT_USD)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/recipient/i)
  })

  it('rejects a tx where value is less than the claimed amount', async () => {
    const rawAmount = BigInt(50 * 10 ** 6)
    mocks.getTransactionReceipt.mockResolvedValue({ status: 'success', blockNumber: 1n })
    mocks.getTransaction.mockResolvedValue({
      to: USDC, from: '0xSENDER7777777777777777777777777777777777',
      input: '0x' + 'a'.repeat(128), value: 0n,
    })
    mocks.decodeFunctionData.mockReturnValue({
      functionName: 'transfer', args: [TREASURY, rawAmount],
    })

    const result = await verifyUsdcOnChain(VALID_TX_HASH, AMOUNT_USD)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/insufficient|amount/i)
  })

  it('rejects a tx whose `to` is not the USDC contract', async () => {
    mocks.getTransactionReceipt.mockResolvedValue({ status: 'success', blockNumber: 1n })
    mocks.getTransaction.mockResolvedValue({
      to: '0xNOTUSDC0000000000000000000000000000000000',
      from: '0xSENDER7777777777777777777777777777777777',
      input: '0xDATA', value: 0n,
    })

    const result = await verifyUsdcOnChain(VALID_TX_HASH, AMOUNT_USD)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/USDC/i)
  })

  it('uses token units for fractional-dollar claims', async () => {
    const rawAmount = 10_250_000n;
    mocks.getTransactionReceipt.mockResolvedValue({ status: 'success', blockNumber: 1n });
    mocks.getTransaction.mockResolvedValue({
      to: USDC, from: '0xSENDER7777777777777777777777777777777777',
      input: '0x' + 'a'.repeat(128), value: 0n,
    });
    mocks.decodeFunctionData.mockReturnValue({
      functionName: 'transfer', args: [TREASURY, rawAmount],
    });

    const result = await verifyUsdcOnChain(VALID_TX_HASH, 10.25);
    expect(result.valid).toBe(true);
  });

  it('binds transferFrom deposits to the calldata payer, not only the transaction sender', async () => {
    const expectedPayer = '0x' + '1'.repeat(40);
    const differentPayer = '0x' + '2'.repeat(40);
    mocks.getTransactionReceipt.mockResolvedValue({ status: 'success', blockNumber: 1n });
    mocks.getTransaction.mockResolvedValue({
      to: USDC, from: expectedPayer,
      input: '0x' + 'a'.repeat(128), value: 0n,
    });
    mocks.decodeFunctionData.mockReturnValue({
      functionName: 'transferFrom', args: [differentPayer, TREASURY, 100_000_000n],
    });

    const result = await verifyUsdcOnChain(VALID_TX_HASH, 100, expectedPayer);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/payer/i);
  });
})
