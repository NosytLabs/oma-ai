# OMA AI Gateway — Agent Protocols

OMA AI supports four agent-to-agent protocols for discovery, tool execution, payment, and response rendering.

---

## 1. A2A (Agent-to-Agent)

OMA publishes an A2A Agent Card for agent discovery.

- **Endpoint:** `GET /.well-known/agent-card.json`
- **Format:** [A2A Agent Card spec](https://github.com/google/a2a)
- **Contents:** Agent identity, capabilities, skills (chat, image, video, search), authentication schemes (x402, SIWE), input/output modes

Agents discover OMA by fetching the card and resolving its skills list for routing.

---

## 2. MCP (Model Context Protocol)

OMA exposes an MCP-compatible JSON-RPC endpoint for tool invocation by other agents and IDEs.

- **Endpoint:** `POST /api/mcp`
- **Format:** [MCP spec](https://modelcontextprotocol.io)
- **Supported methods:** `initialize`, `tools/list`, `tools/call`
- **Exposed tools:**
  - `list_models` — list all available AI models with pricing
  - `chat_completions` — send chat completion requests
  - `get_balance` — check account credit balance
  - `list_api_keys` — list API keys
- **Transport:** HTTP POST with JSON-RPC 2.0 payloads

### Example

```bash
curl -X POST https://api.oma-ai.com/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## 3. x402 (Payment Protocol)

OMA implements the x402 protocol for per-request USDC payments on Base.

- **Spec:** [x402](https://github.com/Concept-Reply/x402)
- **Flow:** Request → 402 Payment Required → Quote → Deposit → Proxy with payment proof
- **Endpoints:**
  - `POST /v1/x402/quote` — get payment quote
  - `POST /v1/x402/deposit` — create deposit
  - `GET /v1/x402/deposit/:orderId/status` — poll status
  - `POST /v1/x402/proxy/chat/completions` — inference with payment proof
- **Settlement:** USDC on Base (chain ID 8453), EIP-712 typed signatures

---

## 4. A2UI (Agent-to-User Interface)

A2UI is planned for rendering interactive responses (forms, cards, charts) via `application/a2ui+json`.

- **Status:** Planned
- **Output mode:** `application/a2ui+json` (listed in Agent Card)
- **Goal:** Structured interactive responses rather than raw JSON/text
- **Advertised in Agent Card:** Yes, under `defaultOutputModes`

---

## Discovery Summary

| Protocol | Discovery Method | Endpoint |
|----------|-----------------|----------|
| A2A | Well-known URL | `/.well-known/agent-card.json` |
| MCP | API endpoint | `/api/mcp` |
| x402 | 402 response + API | `/v1/x402/*` |
| A2UI | Agent Card/Content-Type | `application/a2ui+json` |

Any agent or IDE that supports one or more of these protocols can discover, pay for, and interact with OMA AI inference.