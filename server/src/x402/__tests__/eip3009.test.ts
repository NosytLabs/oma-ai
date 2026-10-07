// @ts-nocheck — test file with complex mock typing
/**
	* EIP-3009 transferWithAuthorization V1 verify path — unit tests.
	*
	* Audit: .audit/x402-eip3009-fix-2026-07-02.md (P0-1 fix). The V1 verify path
	* used to verify on-chain USDC `transfer`/`transferFrom` receipts (user pays
	* gas). It now uses EIP-3009 transferWithAuthorization (gasless for the user).
	*
	* Coverage:
	*   - Happy path: EIP-712 sig recovers to authorization.from, verify returns valid.
	*   - Sig length validation: rejects 32-byte (tx-hash-length) and other oddities.
	*   - Payee pin: rejects when authorization.to != SERVER_TREASURY.
	*   - Amount pin: rejects when authorization.value < maxAmountRequired.
	*   - Time bounds: rejects expired (validBefore in past) and not-yet-valid.
	*   - Replay: nonce already consumed → 422.
	*   - Authorization shape: rejects when JSON is missing required fields.
	*   - Authorization JSON: rejects when authorization isn't valid JSON.
	*   - Sig mismatch: recovered signer != authorization.from → 422.
	*   - Dispatcher: routes EIP-3009 tuple to new path; routes non-JSON to legacy.
	*   - Legacy back-compat: a payment with authorization="opaque-string" still
	*     routes to verifyUsdcTransferReceipt (the receipt-check path).
	*
	* The tests mock viem (recoverTypedDataAddress + publicClient.call) so we can
	* exercise the V1 verify logic without a real RPC or wallet.
	*/
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── DB mock ───────────────────────────────────────────────
const { chain, resetChain } = vi.hoisted(() => {
		type MockChain = Record<string, ReturnType<typeof vi.fn>> & {
				then: (onfulfilled: (value: unknown[]) => unknown, onrejected?: (reason: unknown) => unknown) => Promise<unknown>
		}
		const ch: MockChain = {} as unknown as MockChain
		const METHODS = [
				'select', 'from', 'where', 'limit',
				'insert', 'values', 'returning', 'update', 'set',
				'onConflictDoUpdate',
		]
		for (const m of METHODS) {
				ch[m] = vi.fn()
		}
		Object.defineProperty(ch, 'then', {
				value: function (onfulfilled: (value: unknown[]) => unknown, onrejected?: (reason: unknown) => unknown) {
						return Promise.resolve([]).then(onfulfilled, onrejected)
				},
				writable: true, configurable: true,
		})
		function reset() {
				for (const m of METHODS) ch[m].mockReturnValue(ch)
		}
		return { chain: ch, resetChain: reset }
})
vi.mock('../../db/client.js', () => ({ db: chain, getDb: () => chain }))

// ── Redis mock (SET NX EX returns OK by default; override to simulate replay) ──
const { mockRedis } = vi.hoisted(() => ({
		mockRedis: {
				set: vi.fn().mockResolvedValue('OK'),
				get: vi.fn().mockResolvedValue(null),
				del: vi.fn().mockResolvedValue(1),
		},
}))
vi.mock('../../lib/redis-client.js', () => ({
		getRedisClient: vi.fn().mockResolvedValue(mockRedis),
}))

vi.mock('../../lib/dlq.js', () => ({
		addSettlementToDlq: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/logger.js', () => ({
		logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('../../middleware/rate-limit.js', () => ({
		rateLimit: () => async (_c: unknown, next: () => void) => next(),
}))

// ── Viem mocks ────────────────────────────────────────────
const { recoverTypedDataAddressMock, callMock, writeContractMock, privateKeyToAccountMock, receiptMock } = vi.hoisted(() => ({
	recoverTypedDataAddressMock: vi.fn(),
	callMock: vi.fn(),
	writeContractMock: vi.fn(),
	// Settlement now waits for finality: a mined, successful receipt by
	// default, so the happy path models a real chain, not a bare broadcast.
	receiptMock: vi.fn(async () => ({ status: 'success' })),
	privateKeyToAccountMock: vi.fn(() => ({ address: '0xFac1l1tat0r00000000000000000000000000000' })),
}))
vi.mock('viem', async () => ({
		...await vi.importActual('viem'),
		createPublicClient: vi.fn(() => ({ call: callMock })),
		createWalletClient: vi.fn(() => ({ writeContract: writeContractMock })),
		http: vi.fn(),
		fallback: vi.fn((transports: any[]) => transports[0]),
		parseAbi: vi.fn(() => []),
		decodeFunctionData: vi.fn(),
		encodeFunctionData: vi.fn(() => '0x'),
		formatUnits: vi.fn((v: bigint, d: number) => {
				const s = v.toString().padStart(d + 1, '0')
				return `${s.slice(0, -d)}.${s.slice(-d)}`
		}),
		recoverTypedDataAddress: recoverTypedDataAddressMock,
		keccak256: vi.fn(() => '0x' + 'ab'.repeat(32)),
		encodePacked: vi.fn(() => '0x'),
}))
vi.mock('viem/accounts', () => ({
		privateKeyToAccount: privateKeyToAccountMock,
}))
vi.mock('viem/chains', () => ({
		base: { id: 8453, name: 'Base' },
}))
vi.mock('../../lib/rpc-client.js', () => ({
		getPublicClient: vi.fn(() => ({
			call: callMock,
			// Settlement waits for the receipt before reporting success, so a
			// missing method here correctly fails the verify — this mock has to
			// model a mined, successful transfer.
			waitForTransactionReceipt: receiptMock,
		})),
		resetPublicClient: vi.fn(),
	}))

// ── Config mock ──────────────────────────────────────────
const TREASURY = '0x8581784D3E598cCa3482375CFF2409Ac9DD8c402'
const PAYER = '0x' + '99'.repeat(20) // arbitrary but valid address
const ATTACKER = '0x' + 'bb'.repeat(20)

const { mockConfig } = vi.hoisted(() => ({
		mockConfig: {
				TREASURY_BASE_ADDRESS: '0x8581784D3E598cCa3482375CFF2409Ac9DD8c402',
				// must be 'live' (not 'mock') so the verify path actually runs
				// and dispatches to verifyEip3009Payment / verifyUsdcTransferReceipt.
				// The viem RPC calls are mocked below, so no real network access.
				FACILITATOR_MODE: 'live',
				// a facilitator key, when present, switches verify to the real
				// on-chain submit path. Tests override this per-case.
				FACILITATOR_PRIVATE_KEY: undefined,
				X402_FACILITATOR_PROVIDER: 'coinbase-cdp',
				CHAIN_RPC_URL: 'https://base-rpc.publicnode.com',
				RECEIPT_HMAC_SECRET: 'test-receipt-hmac-secret-at-least-32-chars!',
				PORT: 3001,
				CORS_ORIGIN: 'http://localhost:3000',
				BETTER_AUTH_SECRET: 'test-better-auth-secret-that-is-at-least-32-chars-long!',
				NODE_ENV: 'test',
				DATABASE_URL: 'postgresql://localhost:5432/oma_test',
				REDIS_URL: 'redis://localhost:6379',
		},
}))
vi.mock('../../config.js', () => ({
	config: mockConfig,
	// facilitator.ts gates its dev-only test routes on this export.
	// false keeps those routes mounted, matching this suite's dev setup.
	isProductionEnv: false,
}))

vi.mock('../../auth/middleware.js', () => ({
		sessionAuth: async (_c: unknown, next: () => void) => next(),
}))

import { verifyPayment, type PaymentSignature } from '../facilitator.js'
import { settlementCache } from '../settlement-cache.js'

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
// 65-byte EIP-712 sig placeholder. Real value recovery is mocked via
// recoverTypedDataAddressMock; the on-the-wire shape just needs to be 132 chars.
const VALID_SIG_HEX = '0x' + '11'.repeat(65)
const USDC_AMOUNT_ATOMIC = 1_000_000n // 1 USDC

function makeEip3009PaymentSig(overrides: {
		signature?: string
		authorization?: unknown
		amount?: string
		validAfter?: number
		validBefore?: number
		nonce?: string
		payFrom?: string
		payee?: string
} = {}): PaymentSignature {
		const now = Math.floor(Date.now() / 1000)
		const nonce = overrides.nonce ?? ('0x' + 'ee'.repeat(32))
		const auth = overrides.authorization !== undefined
				? overrides.authorization
				: {
								from: overrides.payFrom ?? PAYER,
								to: overrides.payee ?? TREASURY,
								value: USDC_AMOUNT_ATOMIC.toString(),
								validAfter: (overrides.validAfter ?? now - 60).toString(),
								validBefore: (overrides.validBefore ?? now + 3600).toString(),
								nonce,
						}
		return {
				x402Version: '1',
				signature: overrides.signature ?? VALID_SIG_HEX,
				authorization: typeof auth === 'string' ? auth : JSON.stringify(auth),
				payload: {
						x402Version: '1',
						scheme: 'evm',
						networkId: 'base',
						asset: USDC_BASE,
						amount: overrides.amount ?? '1.00',
						payee: overrides.payee ?? TREASURY,
						payFrom: overrides.payFrom ?? PAYER,
						maxAmountRequired: overrides.amount ?? '1.00',
						validBefore: overrides.validBefore ?? now + 3600,
						validAfter: overrides.validAfter ?? now - 60,
						nonce,
				},
		}
}

describe('EIP-3009 V1 verify path', () => {
		beforeEach(() => {
				vi.clearAllMocks()
				settlementCache.clear()
				resetChain()
				mockRedis.set.mockResolvedValue('OK')
				mockRedis.get.mockResolvedValue(null)
				mockRedis.del.mockResolvedValue(1)
				// Default: signer recovers to PAYER, eth_call simulation succeeds.
				recoverTypedDataAddressMock.mockResolvedValue(PAYER)
				callMock.mockResolvedValue({ data: '0x' + '00'.repeat(32) })
				writeContractMock.mockResolvedValue('0x' + 'cc'.repeat(32))
				mockConfig.FACILITATOR_PRIVATE_KEY = undefined
		})

		// ── Happy path ───────────────────────────────────────────
		it('verifies a valid EIP-3009 authorization (sig recovers, sim passes, no facilitator key → synthetic txHash)', async () => {
				const sig = makeEip3009PaymentSig()
				const result = await verifyPayment(sig)

				expect(result.valid).toBe(true)
				expect(result.amount).toBe('1.000000')
				expect(result.networkId).toBe('base')
				// Synthetic txHash is keccak256(tuple+sig) → mocked to return '0x' + 'ab' * 32
				expect(result.txHash).toBe('0x' + 'ab'.repeat(32))
		})

		it('submits the real on-chain tx when FACILITATOR_PRIVATE_KEY is set', async () => {
				mockConfig.FACILITATOR_PRIVATE_KEY = '0x' + 'aa'.repeat(32)
				writeContractMock.mockResolvedValue('0x' + 'dd'.repeat(32))

				const sig = makeEip3009PaymentSig()
				const result = await verifyPayment(sig)

				expect(result.valid).toBe(true)
				expect(result.txHash).toBe('0x' + 'dd'.repeat(32))
				expect(writeContractMock).toHaveBeenCalledOnce()
				const writeArgs = writeContractMock.mock.calls[0][0]
				expect(writeArgs.functionName).toBe('transferWithAuthorization')
				expect(writeArgs.address).toBe(USDC_BASE)
				expect(writeArgs.args[0]).toBe(PAYER)
				expect(writeArgs.args[1]).toBe(TREASURY)
				expect(writeArgs.args[2]).toBe(USDC_AMOUNT_ATOMIC)
			// The hash is only returned once the transfer is actually mined and
			// succeeded — a broadcast hash alone is not proof of payment.
			expect(receiptMock).toHaveBeenCalledWith(
				expect.objectContaining({ hash: '0x' + 'dd'.repeat(32) }),
			)
		})

		it('refuses to report a payment as valid when the settlement tx reverts', async () => {
			mockConfig.FACILITATOR_PRIVATE_KEY = '0x' + 'aa'.repeat(32)
			writeContractMock.mockResolvedValue('0x' + 'dd'.repeat(32))
			receiptMock.mockResolvedValueOnce({ status: 'reverted' })

			const result = await verifyPayment(makeEip3009PaymentSig())

			expect(result.valid).toBe(false)
			expect(result.error).toMatch(/revert/i)
		})

		// ── Signature length ─────────────────────────────────────
		it('rejects a signature that is not 65 bytes (132 hex chars)', async () => {
				const sig = makeEip3009PaymentSig({ signature: '0x' + '11'.repeat(32) })
				const result = await verifyPayment(sig)
				expect(result.valid).toBe(false)
				expect(result.error).toMatch(/signature length/i)
		})

		// ── Payee pin ────────────────────────────────────────────
		it.each(['not-a-time', '-1', '1.5', ''])('rejects malformed authorization time %j without throwing or calling RPC', async (time) => {
			const sig = makeEip3009PaymentSig()
			const auth = JSON.parse(sig.authorization)
			auth.validAfter = time
			sig.authorization = JSON.stringify(auth)
			const result = await verifyPayment(sig)
			expect(result.valid).toBe(false)
			expect(result.error).toMatch(/time/i)
			expect(callMock).not.toHaveBeenCalled()
		})

		it('rejects a correctly sized non-hex signature without throwing or calling RPC', async () => {
			const result = await verifyPayment(makeEip3009PaymentSig({ signature: '0x' + 'zz'.repeat(65) }))
			expect(result.valid).toBe(false)
			expect(result.error).toMatch(/signature/i)
			expect(callMock).not.toHaveBeenCalled()
		})

		it('rejects when authorization.to does not match the server treasury', async () => {
				const sig = makeEip3009PaymentSig({
						payee: TREASURY,
						authorization: {
								from: PAYER,
								to: ATTACKER, // mismatched payee
								value: USDC_AMOUNT_ATOMIC.toString(),
								validAfter: (Math.floor(Date.now() / 1000) - 60).toString(),
								validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
								nonce: '0x' + 'ee'.repeat(32),
						},
				})
				const result = await verifyPayment(sig)
				expect(result.valid).toBe(false)
				expect(result.error).toMatch(/payee/i)
		})

		// ── Amount pin ───────────────────────────────────────────
		it('rejects when authorization.value is less than maxAmountRequired', async () => {
				const sig = makeEip3009PaymentSig({
						amount: '2.00',
						authorization: {
								from: PAYER,
								to: TREASURY,
								value: USDC_AMOUNT_ATOMIC.toString(), // 1 USDC < 2 USDC required
								validAfter: (Math.floor(Date.now() / 1000) - 60).toString(),
								validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
								nonce: '0x' + 'ee'.repeat(32),
						},
				})
				const result = await verifyPayment(sig)
				expect(result.valid).toBe(false)
				expect(result.error).toMatch(/insufficient/i)
		})

		// ── Time bounds ──────────────────────────────────────────
		it('rejects when validBefore is in the past', async () => {
				const sig = makeEip3009PaymentSig({
						validBefore: Math.floor(Date.now() / 1000) - 60,
						authorization: {
								from: PAYER,
								to: TREASURY,
								value: USDC_AMOUNT_ATOMIC.toString(),
								validAfter: (Math.floor(Date.now() / 1000) - 3600).toString(),
								validBefore: (Math.floor(Date.now() / 1000) - 60).toString(),
								nonce: '0x' + 'ee'.repeat(32),
						},
				})
				const result = await verifyPayment(sig)
				expect(result.valid).toBe(false)
				expect(result.error).toMatch(/expired/i)
		})

		it('rejects when validAfter is in the future', async () => {
				const sig = makeEip3009PaymentSig({
						validAfter: Math.floor(Date.now() / 1000) + 3600,
						authorization: {
								from: PAYER,
								to: TREASURY,
								value: USDC_AMOUNT_ATOMIC.toString(),
								validAfter: (Math.floor(Date.now() / 1000) + 3600).toString(),
								validBefore: (Math.floor(Date.now() / 1000) + 7200).toString(),
								nonce: '0x' + 'ee'.repeat(32),
						},
				})
				const result = await verifyPayment(sig)
				expect(result.valid).toBe(false)
				expect(result.error).toMatch(/not yet valid/i)
		})

		// ── Replay protection ────────────────────────────────────
		it('rejects when nonce has already been consumed (replay)', async () => {
				mockRedis.set.mockResolvedValueOnce(null) // SET NX returns null on duplicate
				const sig = makeEip3009PaymentSig()
				const result = await verifyPayment(sig)
				expect(result.valid).toBe(false)
				expect(result.error).toMatch(/replay|nonce/i)
		})

		// ── Authorization shape ──────────────────────────────────
		it('rejects when authorization is not valid JSON', async () => {
				const sig = makeEip3009PaymentSig({ authorization: 'not-valid-json' })
				const result = await verifyPayment(sig)
				expect(result.valid).toBe(false)
				expect(result.error).toMatch(/eip-3009 authorization/i)
		})

		it('rejects when authorization JSON is missing required EIP-3009 fields', async () => {
				const sig = makeEip3009PaymentSig({
						authorization: { from: PAYER, to: TREASURY /* missing value, validAfter, validBefore, nonce */ },
				})
				const result = await verifyPayment(sig)
				expect(result.valid).toBe(false)
				expect(result.error).toMatch(/missing required/i)
		})

		// ── Signature mismatch ───────────────────────────────────
		it('rejects when the recovered signer does not match authorization.from', async () => {
				recoverTypedDataAddressMock.mockResolvedValueOnce(ATTACKER)
				const sig = makeEip3009PaymentSig()
				const result = await verifyPayment(sig)
				expect(result.valid).toBe(false)
				expect(result.error).toMatch(/signature does not match/i)
		})

		it('rejects when viem.recoverTypedDataAddress throws', async () => {
				recoverTypedDataAddressMock.mockRejectedValueOnce(new Error('malformed sig'))
				const sig = makeEip3009PaymentSig()
				const result = await verifyPayment(sig)
				expect(result.valid).toBe(false)
				expect(result.error).toMatch(/invalid eip-712 signature/i)
		})

		// ── Simulation failure ───────────────────────────────────
		it('rejects when the contract simulation reverts (e.g. nonce already used)', async () => {
				callMock.mockRejectedValueOnce(new Error('execution reverted: FiatTokenV2_2: authorization is used or canceled'))
				const sig = makeEip3009PaymentSig()
				const result = await verifyPayment(sig)
				expect(result.valid).toBe(false)
				expect(result.error).toMatch(/simulation failed/i)
		})

		// ── Submit failure (with FACILITATOR_PRIVATE_KEY) ────────
		it('rejects when writeContract fails despite a configured facilitator key', async () => {
				mockConfig.FACILITATOR_PRIVATE_KEY = '0x' + 'aa'.repeat(32)
				writeContractMock.mockRejectedValueOnce(new Error('insufficient funds for gas'))
				const sig = makeEip3009PaymentSig()
				const result = await verifyPayment(sig)
				expect(result.valid).toBe(false)
				expect(result.error).toMatch(/submit failed/i)
		})

		// ── Dispatcher behavior ──────────────────────────────────
		it('routes a payment with non-JSON authorization to the legacy receipt-check path', async () => {
				// Authorization is opaque (not EIP-3009 JSON). Signature is a 32-byte tx
				// hash. The legacy verifyUsdcTransferReceipt path takes over. We don't
				// mock the receipt RPC here; the call will fail because no RPC is
				// available, but the important assertion is that the legacy path was
				// attempted (i.e. the dispatcher did NOT throw an "Invalid authorization"
				// EIP-3009 error).
				const sig = makeEip3009PaymentSig({
						authorization: 'opaque-string-not-json',
						signature: '0x' + 'aa'.repeat(32), // 32-byte hex (tx-hash shape)
				})
				const result = await verifyPayment(sig)
				// The legacy path will try to call getTransactionReceipt on the mocked
				// viem client (which doesn't exist here), so we expect a non-EIP3009 error.
				expect(result.valid).toBe(false)
				expect(result.error).not.toMatch(/invalid authorization: must be json-encoded eip-3009/i)
		})
})

// ── Audit fix tests (round 3) ──────────────────────────────────────────
//
// Covers three Round 3 fixes:
//   1. STRICT amount: overpayment is rejected (audit 3.3 / HIGH)
//   2. High-S signature: rejected (audit 3.1 / MEDIUM)
//   3. chainId: derived from the request's networkId, never hardcoded
//      (audit 3.1 / MEDIUM)
describe('EIP-3009 audit round-3 fixes', () => {
		beforeEach(() => {
				vi.clearAllMocks()
				settlementCache.clear()
				resetChain()
				mockRedis.set.mockResolvedValue('OK')
				mockRedis.get.mockResolvedValue(null)
				mockRedis.del.mockResolvedValue(1)
				recoverTypedDataAddressMock.mockResolvedValue(PAYER)
				callMock.mockResolvedValue({ data: '0x' + '00'.repeat(32) })
				writeContractMock.mockResolvedValue('0x' + 'cc'.repeat(32))
				mockConfig.FACILITATOR_PRIVATE_KEY = undefined
		})

		// SECP256K1_N/2 — EIP-2 boundary. Any signature with s > this value is
		// a non-canonical (high-S) signature and must be rejected.
		const SECP256K1_N_OVER_2_HEX = '7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0'

		// Build a 65-byte signature whose `s` component lands above the
		// EIP-2 boundary. Layout: r (32 bytes = 64 hex) + s (32 bytes = 64
		// hex) + v (1 byte = 2 hex). We use a fixed r (any 32 bytes), set s
		// to N/2 + 1, and v to 0x1b (27, a valid EIP-155 v).
		function buildHighSSigHex(): string {
				const r = '11'.repeat(32) // 32 bytes of arbitrary r
				// s = N/2 + 1, big-endian, 32 bytes
				const sBig = BigInt('0x' + SECP256K1_N_OVER_2_HEX) + 1n
				const s = sBig.toString(16).padStart(64, '0')
				const v = '1b'
				return '0x' + r + s + v
		}

		// ── Fix #15: strict payment amount (reject overpayment) ─────────
		it('rejects overpayment (auditAtomic > requiredAtomic)', async () => {
				const sig = makeEip3009PaymentSig({
						amount: '1.00', // required
						authorization: {
								from: PAYER,
								to: TREASURY,
								value: (USDC_AMOUNT_ATOMIC * 2n).toString(), // 2 USDC > 1 USDC required
								validAfter: (Math.floor(Date.now() / 1000) - 60).toString(),
								validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
								nonce: '0x' + 'ee'.repeat(32),
						},
				})
				const result = await verifyPayment(sig)
				expect(result.valid).toBe(false)
				expect(result.error).toMatch(/overpayment/i)
		})

		it('rejects a zero required amount (would otherwise be a free pass)', async () => {
				const sig = makeEip3009PaymentSig({
						amount: '0',
						authorization: {
								from: PAYER,
								to: TREASURY,
								value: '1000000',
								validAfter: (Math.floor(Date.now() / 1000) - 60).toString(),
								validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
								nonce: '0x' + 'ee'.repeat(32),
						},
				})
				const result = await verifyPayment(sig)
				expect(result.valid).toBe(false)
				expect(result.error).toMatch(/positive/i)
		})

		// ── Fix #16: reject high-S signatures (EIP-2) ──────────────────────
		it('rejects a signature with s > secp256k1 N/2 (EIP-2 low-S rule)', async () => {
				const highSSig = buildHighSSigHex()
				expect(highSSig.length).toBe(132) // sanity: still 65 bytes
				const sig = makeEip3009PaymentSig({ signature: highSSig })
				const result = await verifyPayment(sig)
				expect(result.valid).toBe(false)
				expect(result.error).toMatch(/high-s/i)
		})

		it('accepts a signature with s exactly at secp256k1 N/2 (boundary)', async () => {
				// s = N/2 — the high-S check uses `>`, so this is on the low-S side
				// and must pass through to the recovery step (where viem is mocked to
				// recover PAYER, completing a happy-path verify).
				const r = '11'.repeat(32)
				const s = SECP256K1_N_OVER_2_HEX
				const v = '1b'
				const boundarySig = '0x' + r + s + v
				const sig = makeEip3009PaymentSig({ signature: boundarySig })
				const result = await verifyPayment(sig)
				expect(result.valid).toBe(true)
		})

		// ── Fix #17: chainId derived from networkId ─────────────────────────
		it('passes the networkId-derived chainId to recoverTypedDataAddress', async () => {
				const sig = makeEip3009PaymentSig()
				await verifyPayment(sig)
				expect(recoverTypedDataAddressMock).toHaveBeenCalledTimes(1)
				const recoverArgs = recoverTypedDataAddressMock.mock.calls[0][0]
				expect(recoverArgs.domain.chainId).toBe(8453) // Base mainnet (default network)
		})

		it('falls back to the Base chainId when an unknown networkId is supplied', async () => {
				const sig = makeEip3009PaymentSig()
				sig.payload.networkId = 'unknown-network'
				await verifyPayment(sig)
				expect(recoverTypedDataAddressMock).toHaveBeenCalledTimes(1)
				const recoverArgs = recoverTypedDataAddressMock.mock.calls[0][0]
				expect(recoverArgs.domain.chainId).toBe(8453)
		})
})
