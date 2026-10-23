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

Read `maxAtomicAmount` from the same response before signing. The public verify
route caps funding at the configured `USDC_DEPOSIT_MAX_CENTS` ($10,000 default),
with exact integer atomic-unit comparison before any transfer verification or
broadcast. `x402_funding_limit` is a non-retryable 400 for that authorization.
Positive sub-cent x402 payments remain supported. Do not split an unexpectedly
large payment automatically; confirm the intended amount and configured limit.

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

If any transfer in a scanned block range fails processing, the recovery cursor
stays at the previous block. Other transfers are still processed, and the range
is retried on the next iteration. Durable credit claims make that replay safe;
a temporary database or RPC error must not advance the cursor past paid funds.

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

The settlement retry queue retains its signed receipt after 12 failed
attempts. Rows with `attempts >= 12` require manual reconciliation and are
excluded from automatic drains; re-enqueueing does not reset that marker.
Queue-depth counts include these unresolved rows. Inspect the existing
transaction/settlement/credit records, fix the underlying failure and reconcile
the original payment before deliberately resuming a row. Never delete its
receipt or request another payment merely to clear an alert. New queue failure
diagnostics contain bounded database metadata rather than SQL values or raw
driver messages.

## Pending, failed, or uncertain verification

- A timeout can return `valid: false` with a `txHash`. Save it and inspect the chain receipt before creating another authorization. Once confirmed successfully, settle that same hash.
- If no hash was returned, reconcile the payer's wallet activity and signed authorization nonce before authorizing another payment. A client timeout alone does not prove that no transfer occurred.
- A reverted receipt does not establish payment. Investigate the failure before making a new authorization.
- `x402_payer_mismatch` (403) means the session wallet cannot claim that transfer. Use the paying wallet's session.
- `x402_verify_required` (400) means the server has no accepted confirmed payment evidence for that hash. Check the hash, chain, USDC asset, recipient, and confirmation.
- `x402_credit_failed` after confirmed payment means crediting needs a retry or operator investigation. Preserve the hash and retry settlement; do not collect another payment.

Ordinary chat uses the prepaid balance with an API key. An insufficient-credit 402 on inference is not a request to attach a payment signature to the chat call. Fund separately, then retry inference.

## Inference holds and reconciliation

Migration `0007_inference_credit_reservations` must be applied before the API
release that uses prepaid holds. Both chat formats reserve a conservative
maximum charge before inference. The spendable balance excludes the hold.
Completed usage and its actual charge settle atomically; unused credits return
to spendable balance. Known pre-execution rejections release once. An uncertain
upstream outcome, stream cancellation, usage exceeding its quoted bound, or
billing-store outage retains the hold for review. There is no timed automatic
refund. Paid inference does not retry an ambiguous upstream attempt.

The native operator API provides `GET /v1/admin/credit-holds` (default unresolved
states; optional `state`, `userId`, `limit` up to 100, and `offset` up to 10,000)
and `GET /v1/admin/credit-holds/:requestId`. Both require administrator auth,
are rate limited, and return `Cache-Control: no-store`. The detail includes the
usage/cost receipt when one exists. These routes are not proxied by the public
website. Customer balance endpoints separately report active `reservedCents`
and uncertain `reconciliationCents`, preserving fractional cents as strings.

Detached accounting remains available after the account-linked hold has
cascaded on deletion: native `GET /v1/admin/credit-holds-receipts` lists up to
100 unresolved financial intents, and `/:requestId` reads one receipt. These
use the same operator-only controls. The receipt has no account/customer
content or foreign key and is created before inference, so an in-flight account
deletion or worker crash does not erase the original intent. A failed attempt
to update it during a database outage leaves that original row held for review.

Keep the customer's request ID and idempotency key. Reuse the same key while
investigating; it cannot begin another request while a held or reconciliation
reservation survives. Do not recommend a new key or refund solely because the
client disconnected. A cancelled stream may have incurred an upstream bill.
History deletion does not erase holds or retry claims. Account deletion
cascades account-linked holds, as it does account usage records.

Use read-only queries against the intended environment. These show unresolved
holds, the associated usage receipt, and the distinction between spendable and
held credits:

```sql
SELECT r.request_id, r.user_id, r.state, r.reserved_cents,
       r.created_at, r.updated_at, u.status AS usage_status,
       u.provider_response_id, u.input_tokens, u.output_tokens, u.cost_cents, u.total_cents
FROM inference_credit_reservations r
LEFT JOIN usage_records u ON u.request_id = r.request_id
WHERE r.state IN ('held', 'reconciliation')
ORDER BY r.created_at;

SELECT request_id, requested_model, model, provider, provider_response_id,
       reserved_cents, cost_cents, charged_cents, refunded_cents,
       cost_known, usage_verified, state, pricing_snapshot, created_at
FROM inference_financial_receipts
WHERE state IN ('held', 'reconciliation') ORDER BY created_at;

SELECT b.user_id, b.balance_cents AS spendable_cents,
       b.total_deposited_cents, b.total_used_cents,
       COALESCE(h.held_cents, 0) AS held_cents
FROM credit_balances b
LEFT JOIN (
  SELECT user_id, SUM(reserved_cents) AS held_cents
  FROM inference_credit_reservations
  WHERE state IN ('held', 'reconciliation') GROUP BY user_id
) h USING (user_id);

SELECT network_id, tx_hash, attempts, next_attempt_at, settled_at
FROM settlement_dlq ORDER BY settled_at;
```

Compare the original provider request and timestamp with provider billing
history. Venice's current read endpoints are `/api/v1/billing/balance` and
`/api/v1/billing/usage-history`; the old `/billing/usage` endpoint is removed.
Do not log provider credentials or response content. A catalog token-price
estimate is not a provider invoice, and OpenBroker/Gonka USD cost remains
unknown until GNK procurement cost is recorded.

Once the original outcome is verified, resolve the original reservation in one
reviewed transaction: lock the reservation and balance, verify its still-held
state, record the evidenced actual customer charge/usage, return only the
unused hold, update lifetime usage and mark the reservation settled. For
verified zero execution, return the hold and mark it released. Keep terminal
rows so a repeated resolution cannot refund or charge twice. There is no public
automatic hold-resolution endpoint; operator reconciliation must use an
authorized database transaction with independent evidence. Do not delete a
hold or edit only the balance to clear the alert.

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
