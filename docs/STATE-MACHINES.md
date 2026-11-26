# State and recovery map

Use this map to locate the owner of a lifecycle before changing a boolean, status
string, retry or callback. A vocabulary or transition table alone does not enforce
runtime transitions: check its callers and the database predicates too.

| Lifecycle | States / events | Owner and invariant |
| --- | --- | --- |
| Chat request | idle → sending → streaming → idle; failure/cancellation remain terminal until send | `app/src/lib/chat/chat-request-state.ts`. `loading` is derived in `usePlaygroundState.ts`. An ignored event must preserve both phase and failure payload. Only a new send clears a terminal failure. |
| Auth session | loading → unauthenticated / demo / authenticated | `app/src/lib/hooks/useAuth.ts` (`AUTH_STATUS` / `authStatus`). The legacy booleans (`isReady`, `isPending`, `isDemo`, `isAuthenticated`) are kept as compatibility views of the same state; new consumers read `authStatus`. A hung session resolves to unauthenticated after 5 s. |
| Magic-link send | idle → sending → sent / error; a discarded op (newer send, email edited, unmount) writes nothing | `app/src/app/login/_components/LoginPageClient.tsx` via `useAsyncState({ concurrency: "reject-new" })`. Double submit is refused while in flight; error feedback is suppressed when the email field changed since the send started. |
| Generic async op | idle → loading → success / error; rejected ops resolve `null` and are discarded | `app/src/lib/state/async-state.ts` + `use-async-state.ts`. Reusable primitive with two concurrency modes: `reject-new` (forms, no double submit) and `supersede-old` (fetch/refresh, latest op wins). Failure keeps prior data so a failed refresh does not blank the screen. New async components should use this instead of `isLoading` booleans. |
| Chat request ownership | current generation → obsolete on account/conversation change or unmount | `app/src/app/chat/_hooks/useStreamingChat.ts`. Abort plus generation/owner checks prevent old responses from updating a new conversation. Primary and comparison errors remain separate. |
| Browser chat key repair | absent attempt → pending promise → settled result; reset on new send/owner | `useStreamingChat.ts`, `ensureChatKeyOnce`. Primary and comparison requests share one repair attempt within a send. |
| Chat panels | open/closed per panel | `app/src/lib/chat/panel-state.ts`. Derived legacy boolean setters use the shared panel representation; do not add independent flags. |
| Deposit screen | select → processing → complete/error; wallet rejection → select; retry → processing | `app/src/app/deposit/_components/deposit-flow-state.ts` and `UnifiedDepositInterface.tsx`. Screen progress is distinct from money being credited. The transition helper describes allowed moves, but current component setters do not call `canTransitionDepositFlow`; asynchronous ownership checks remain the runtime protection. |
| Broadcast deposit recovery | no pending transfer → stored broadcast → registered, or retry registration | `UnifiedDepositInterface.tsx` and its pending-deposit storage helpers. Retain the already broadcast transaction when registration fails. Retry registration rather than sending another transfer. |
| Deposit record | pending/settling → completed/failed/expired; completed → refunded | `server/src/lib/deposit-status.ts`, mirrored by `app/src/lib/api/deposit-status.ts`. `settling` is currently reserved vocabulary, not proof that a writer uses it. Terminal deposit status must not render as ongoing funding. |
| Refund request | pending → granted/denied | `server/src/lib/refund-status.ts` and refund routes. A repeated decision must not apply a second financial mutation. |
| Inference credit reservation | held → released/settled/reconciliation; reconciliation → settled | `server/src/lib/credit-reservation-state.ts` and billing writers. An ambiguous provider outcome retains the hold until evidence resolves it. Released and settled are terminal. |
| Inference idempotency claim | pending → completed; unbilled release deletes row | `server/src/lib/inference-claim-state.ts` and idempotency middleware. A missing row is a released claim, not a new stored state. Expired leases and open financial reservations must be evaluated together. |
| Polar webhook | claimed/unprocessed (0) → processed (1) | `server/src/lib/polar-webhook-state.ts` and Polar routes. Keep the financial operation and processing marker idempotent. The integer storage format is unchanged. |
| Settlement recovery queue | pending retry → recovered/deleted or abandoned after 12 attempts | `server/src/lib/settlement-dlq-state.ts`. Attempts, next retry time and last error encode the state. Abandoned evidence stays available for operator reconciliation. |
| Redis connection | disconnected → ready or error/backoff → retry | `server/src/lib/redis-connection-state.ts`. Readiness, reason, failed attempts and retry delay must agree; missing shared storage is not healthy production readiness. |
| Chain receipt observation | unknown/pending → successful or reverted observation | `server/src/x402/receipt-status.ts`. Only explicit success passes receipt validation. Receipt success alone does not imply local credit settlement completed. |

This is a maintained map of the lifecycle boundaries above, not a proof that every
possible application state has been modeled. Usage statuses, model metadata and
availability labels also have shared vocabularies; they are observations and
outcomes, not automatically transition-driven workflows.

## Verification

`pnpm validate:hygiene` checks shared vocabulary parity, alongside repository
hygiene. It does not prove every call site enforces the documented transitions.
Use regression tests that deliver late events, switch owners, retry after an
ambiguous result and exercise persistence failures.

For chat request changes:

```sh
pnpm --filter app exec vitest run src/lib/chat/__tests__/chat-request-state.test.ts src/app/chat/_hooks/__tests__/useStreamingChat.state.test.ts
pnpm --filter app run typecheck
```

Run the full repository validation before a broad release. Payment or auth changes
also need their dedicated integration checks; pure reducer tests do not establish
mainnet payment finality, live provider availability or deployment success.
