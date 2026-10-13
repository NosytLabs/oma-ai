# Settlement operations: Base USDC, x402, and card credits

This runbook describes the implemented recovery procedure. It does not assert the current live payment-rail status, wallet balance, vendor plan, or deployment configuration. Check live readiness and payment settings before a funding test.

- [`PLATFORM.md`](PLATFORM.md) is the source of truth for billing, authentication, funding rails, and required configuration.
- [`DEPLOYMENT.md`](DEPLOYMENT.md) is the source of truth for production targets, branches, deployment commands, and verification. The frontend and API deploy separately.
- [Public x402 documentation](https://www.oma-ai.com/docs#x402) contains the customer request sequence.

## x402 prerequisites

The crypto funding switch pauses new `/x402/verify` transfers, direct-deposit instructions/submissions, and wallet challenges. The card switch pauses new hosted checkouts. If payment settings cannot be read, these routes return `503 funding_status_unavailable` with `Retry-After: 30`; no new transfer or checkout begins. Public `/api/v1/site-settings` remains readable with `paymentStatusAvailable: false` and both payment flags disabled. Configuration flags describe setup, not current availability.

A funding pause leaves `/x402/settle` and deposit recovery available for funds already sent. Confirmed funds retain the same payer and durable credit-claim checks; retries cannot mint additional credits. Maintenance mode is a separate site-wide control.

Confirm the API environment has the production configuration described in PLATFORM: a real treasury, Base RPC access, a facilitator signing key, receipt-signing secrets, Postgres, and durable replay/rate-limit storage. Production and staging reject mock settlement. Keep secrets in the deployment's secret store; do not copy a local development environment over the live function configuration.

The facilitator needs Base ETH for transaction gas. The **payer wallet** needs the USDC being transferred. Read current balances and network gas conditions rather than relying on a fixed seed amount or historical cost estimate. QuickNode can provide Base RPC; it is not a substitute for the configured settlement implementation.

Before sending funds, establish a SIWE session with the paying wallet. Read the
x402 recipient from `GET https://www.oma-ai.com/x402/info` and compare it with the
intended recipient. Direct-deposit instructions can specify a different address;
do not substitute it for x402 or use an address copied from an old runbook.

## Direct wallet deposit recovery

The direct deposit flow uses a customer-paid USDC transfer and an EIP-191
ownership proof, separately from x402's relayed EIP-3009 authorization.

1. Read authenticated `/api/v1/deposit/usdc` instructions. Obtain an
   account-bound challenge from `/api/v1/deposit/usdc/challenge` before sending.
2. The wallet transfers USDC on Base. Preserve its transaction hash, sending
   wallet, recipient and amount before requesting the ownership signature.
3. If proof signing or registration fails, use **Retry registration**. It
   requests a fresh challenge and signature for that same transfer. Do not
   send another transfer because the proof was refused or expired.
4. Recovery metadata remains in the same browser tab's account-scoped session
   storage when available. After a reload, sign into the original account and
   reconnect the sending wallet. No signature or session credential is stored
   with the recovery metadata. If browser storage is blocked or the tab is
   closed, retain the hash separately and ask the operator to investigate.
5. Check the successful Base receipt and matching USDC log, then the deposit
   record and ledger credits. Registration success is not chain confirmation.

The API still verifies the user-bound challenge, recovered wallet signer and
actual transfer evidence. Client recovery metadata cannot grant ownership or
credits by itself.

## The two funding operations

| Operation | Effect | Authentication |
|-----------|--------|----------------|
| `POST https://www.oma-ai.com/x402/verify` | Validates the signed authorization, broadcasts the USDC transfer, and waits for confirmation | Signed payment envelope |
| `POST https://www.oma-ai.com/x402/settle` | Records settlement and credits the confirmed transfer to the payer's account | SIWE session cookie; linked wallet must equal the USDC payer |

**Verification moves funds. It is not a dry run.** Signing an authorization locally does not itself transfer USDC, but submitting it to verify can. Settlement does not send a second transfer. API keys authenticate subsequent inference, not settlement.

The preferred payment header is `PAYMENT-SIGNATURE: <base64 JSON>`, using v2 `x402Version: 2`, `accepted` requirements, and `payload.signature` plus the EIP-3009 authorization. The accepted asset, treasury, and atomic amount must match the signed authorization. Legacy raw-JSON OMA envelopes and the older `X-PAYMENT` header are still accepted.

## Confirmed payment with missing credits

1. Preserve the `txHash`, network, expected treasury, payer wallet, and intended amount. Do not log private keys, session cookies, or signed payment envelopes.
2. Check the Base transaction receipt. Require a successful receipt and the expected USDC Transfer log to the configured treasury. A broadcast hash alone is not confirmation.
3. Read the USDC payer from the Transfer log's `from`, **not the transaction's top-level sender**. EIP-3009 transactions are relayed, so the transaction sender is the facilitator.
4. Confirm that the signed-in account's linked wallet matches that USDC payer. If it does not, use the correct wallet session. Do not change an account's wallet or assign the deposit to a different user to make it pass.
5. Retry `POST /x402/settle` with the same `{ txHash, networkId: "base" }` and that payer's session cookie. Do not supply an amount and do not sign another payment solely because crediting is pending.
6. Check for `settled: true`, a signed receipt string, and `creditedCents`, then verify the account balance and deposit record. A retry may report the same credited amount; it does not mean the balance was credited a second time.

Settlement recovers after a cold start from the confirmed USDC receipt when the in-memory verification record is gone. It also checks existing settlement and deposit records. Crediting is transactional and idempotent by transaction hash, and the same payment cannot be credited to another account. Fractional credits are preserved: 1 USDC equals 100 credits, including sub-cent amounts.

Receipt recovery accepts a single unambiguous positive USDC transfer to the configured treasury. Do not guess payer ownership or aggregate ambiguous multi-transfer receipts; investigate those records before taking any manual action.

## Pending, failed, or uncertain verification

- A timeout can return `valid: false` with a `txHash`. Save it and inspect the chain receipt before creating another authorization. Once confirmed successfully, settle that same hash.
- If no hash was returned, reconcile the payer's wallet activity and signed authorization nonce before authorizing another payment. A client timeout alone does not prove that no transfer occurred.
- A reverted receipt does not establish payment. Investigate the failure before making a new authorization.
- `x402_payer_mismatch` (403) means the session wallet cannot claim that transfer. Use the paying wallet's session.
- `x402_verify_required` (400) means the server has no accepted confirmed payment evidence for that hash. Check the hash, chain, USDC asset, recipient, and confirmation.
- `x402_credit_failed` after confirmed payment means crediting needs a retry or operator investigation. Preserve the hash and retry settlement; do not collect another payment.

Ordinary chat uses the prepaid balance with an API key. An insufficient-credit 402 on inference is not a request to attach a payment signature to the chat call. Fund separately, then retry inference.

## Card checkout and webhook reconciliation

Polar collects one-time card payments and sends signed order events to the API. OMA's Postgres ledger remains the authoritative spendable balance; the platform does not require Polar usage meters or recurring subscriptions.

For product IDs and secrets, use the live API configuration and the operator requirements in PLATFORM. Confirm that the configured products are the intended one-time credit packs, that the card rail is available, and that the webhook reaches the API deployment. Do not put backend Polar secrets on the frontend solely to make checkout appear configured.

When a paid order has not produced credits:

1. Compare the Polar order and webhook delivery with the OMA account and deposit/credit records.
2. Inspect webhook verification and processing errors. Confirm that the deployed secret and product mapping match the live webhook and order.
3. Use the supported webhook retry/redelivery workflow and verify the ledger result. Check for an existing credit before any manual adjustment.
4. Keep order IDs, transaction hashes, and account IDs in the operational incident record; exclude secrets and payment-card details.

Before rotating a webhook secret, verify the provider's retry behavior and the deployed verifier's key support, then plan the cutover and reconciliation of pending events. Do not assume the verifier supports multiple secrets or that historical deliveries will be re-signed automatically.

## Deployment and completion checks

Follow the canonical DEPLOYMENT reference for current production branch and release procedures. A frontend deploy does not ship API settlement changes. Do not rely on historical branch bugs, mock-mode snapshots, vendor rate limits, or cost estimates as current operational facts.

After releasing API changes, check native readiness (including Postgres and Redis), public proxy responses, and live payment-rail status. A malformed verification request is a safe transport check; a real signed authorization is a funds-moving operation. Treat a payment test as complete only after its chain outcome and resulting credit entry are reconciled.
