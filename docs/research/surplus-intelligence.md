# Surplus Intelligence — Research Note

> Compiled: 2026-08-14
> Source: live API + docs + third-party coverage

## TL;DR
- Base URL: `https://api.surplusintelligence.ai/v1`
- Auth: `Authorization: Bearer <SURPLUS_API_KEY>`
- Compatibility: OpenAI-compatible drop-in (also supports Anthropic skin at `/anthropic`)

## API surface
- /v1/chat/completions: OpenAI-compatible.
- /v1/models: Lists catalog models (145+ in snapshot).
- Streaming: Supported (`stream: true`).

## Pricing
- Marketplace for compute: sellers compete on price.
- Settlement: USDC on Base.
- No percentage markup (multiplier 1.0x).

## Trust & security
- Cryptographic proof of model served: **NOT supported.**
- Reputation/scoring: Planned but not live. Today tracks health/liquidity, not quality.
- "What does not exist today: cryptographic proof that a seller served the exact claimed model."

## Model catalog snapshot
- 145+ catalog models (text, vision, image, audio, video, TTS/STT, embeddings).

## Risk assessment for OMA resale
- The platform uses a "trusted provider" allowlist.
- Settlement failure risks exist; permanent settlement failure may require manual reconciliation.
- Operator/IAM trust boundary exists for KMS-encrypted seller API keys.

## Integration plan for OMA-AI
- Env vars: `SURPLUS_API_KEY`
- Catalog format: Standard `/v1/models`
- Provider route branch: `https://api.surplusintelligence.ai/v1`
- Margins/pricing: Pass-through (no marketplace markup).
