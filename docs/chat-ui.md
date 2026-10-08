# Chat UI

The `/chat` workspace uses the existing OMA API and authentication. Interactive
mode adds OpenUI response rendering inside the normal conversation; it does not
send inference through a separate hosted UI gateway.

## Responsibilities

| Concern | Source |
|---------|--------|
| Access gates, toolbar, parameters, history and action integration | `app/src/app/chat/_components/ChatPlaygroundShell.tsx` |
| Account model preferences and atomic parameter updates | `app/src/app/chat/_hooks/usePlaygroundState.ts` |
| Conversation lifecycle and persistence | `app/src/app/chat/_hooks/useConversationHistory.ts` |
| Storage schema, validation and legacy migration | `app/src/lib/chat-storage.ts` and `chat-message-validation.ts` |
| Request ownership, search, cancellation and streaming | `app/src/app/chat/_hooks/useStreamingChat.ts` |
| Shared message frame, Markdown, reasoning, sources and metadata | `app/src/components/chat/ChatMessage.tsx` |
| Text, OpenUI and legacy A2UI classification | `app/src/lib/openui-message-format.ts` |
| OMA component catalog and generated model instructions | `app/src/lib/openui.tsx` |
| Allowed generated actions and validation | `app/src/lib/openui-actions.ts` |

Primary and comparison messages use the same rendering path. Retry removes the
latest primary turn and its corresponding comparison turn before resending.
New comparison turns share the user message ID so this pairing is unambiguous.

## Conversation history

History is stored in this browser's local storage, separately for guests and
each authenticated account. It does not provide cloud synchronization. Each
thread keeps its messages, composer draft, selected model, title and pinned state.
Users can search, rename, pin, export and delete threads.

The versioned keys are `oma_chat_history:v1:guest` and
`oma_chat_history:v1:u:<userId>`. On first use, the prior single-conversation
storage is migrated into a thread. The legacy key is retained. New chat and
import preserve the previous thread. Messages are not silently trimmed to a
fixed count.

Storage read or validation failures stop automatic writes to that bucket and
show a persistence error. Storage write failures remain visible so users can
export their work. Account transitions wait for model preferences to hydrate
before loading history. An initial explicit `?model=` takes precedence over the
saved active thread's model; subsequent thread switches restore thread models.

Navigation reads of the active model are side-effect free. The sign-in handoff
clears the original draft only after a nonempty handoff draft is successfully
saved. Storage failures leave the original draft available.

## Interactive responses

The OpenUI catalog contains `Card`, `Stack`, `Text`, `Button`, `ModelComparison`
and `SettingsForm`. Extend this catalog to add approved OMA components, then use
its generated prompt to keep the model's instructions aligned with the schemas.
The application retains its existing legacy A2UI renderer for old conversations;
this is not a claim of complete A2UI protocol support.

Generated controls support two explicit actions:

- `followup` sends a bounded prompt through the normal access and quota gates.
- `apply-settings` validates the model against the live catalog and validates
  numeric settings against the same bounds used by the parameter panel.

Numeric settings are persisted atomically before the interface reports success.
Applying a form does not itself make an inference request. Action controls show
pending, success or failure and reject duplicate submissions while pending.
OpenUI observability and automatic developer-tool mounting are disabled.

Each assistant message records its intended format locally. Only `role` and
`content` are sent in API message objects. Ordinary prose continues to stream as
Markdown when Interactive mode is enabled. Partial OpenUI syntax uses the
structured renderer; completed content is checked against the catalog before
rendering. JSON exports preserve optional message metadata and imports validate
known fields while retaining future metadata.

## Request and layout behavior

A send captures its model, prompt, generation parameters, format and histories
before web search begins. Search results are fetched once and reused for both
comparison requests. Stop aborts search and inference. An account or thread
change invalidates the request, and late responses cannot update a replacement
conversation. Each response targets its own assistant message ID.

Paid-chat API-key recovery uses the same cancellation signal. Browser API-key
installation validates ownership, and cookie-based API authentication requires
a matching live Better Auth session on every use. Explicit `Authorization` and
`x-api-key` credentials retain their standalone API behavior. This protection
ships in both `app/` and `server/`; use the existing frontend and backend release
procedures in [Deployment](DEPLOYMENT.md).

The composer keeps Interactive and Web controls visible. Parameters are
available from More even before the first message. Conversation history uses a
desktop sidebar and a mobile drawer. The consent banner publishes its measured
height through `--consent-banner-height`; the chat viewport reserves that space
so the composer remains reachable before consent is dismissed.

## Validation

Run the repository gate from the root:

```bash
pnpm validate
pnpm --filter app run test:e2e
```

The browser suite uses deterministic API fixtures for chat, model availability,
quota and authentication. It checks responsive layout, toolbar access, model
selection, response/Stop behavior, generated settings and history persistence.
The optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` points to an existing browser
when Playwright's managed Chromium is unavailable. Provider availability and
paid-account behavior still require deployment-specific verification.
