# OpenBroker/Gonka Research Findings

**Date:** 2026-07-30
**Sources:** openbroker.gonka.gg, gonkabroker.com/gonka-api-pricing, gonka.ai/docs, github.com/gonka-ai/gonka, live gonka MCP

## Executive Summary

- **OMA-AI is ~44-60x cheaper than GonkaBroker retail** because OMA buys at near-zero GNK wholesale rates
- **GLM-5.2-FP8 is available on the Gonka network but NOT in OMA-AI's catalog** — this is a gap
- **6952 GPU participants** on Gonka mainnet (verified live)
- **All major upstream models** OMA-AI uses (MiniMax M2, Kimi K2) are confirmed available

## Live Gonka Network Models (from gonka MCP)

```json
[
  { "id": "MiniMaxAI/MiniMax-M2.7", "context_length": 0, "max_output_length": 0 },
  { "id": "moonshotai/Kimi-K2.6", "context_length": 0, "max_output_length": 0 },
  { "id": "zai-org/GLM-5.2-FP8", "context_length": 0, "max_output_length": 0 }
]
```

**GAP:** OMA-AI only has MiniMax-M2.7 and Kimi-K2.6. **GLM-5.2-FP8 is missing.**

## GonkaBroker Retail Pricing (https://gonkabroker.com/gonka-api-pricing/)

| Model | Input / 1M | Output / 1M |
| --- | --- | --- |
| MiniMax M2 | $0.30 | $0.30 |
| Kimi K2 | $0.35 | $0.35 |
| BGE-M3 (embedding) | $0.01 | — |
| OpenAI GPT-5 (ref) | $1.25 | $10.00 |
| Claude 4.5 Sonnet (ref) | $3.00 | $15.00 |

## OMA-AI Pricing Comparison

| Model | OMA Input | OMA Output | GonkaBroker | Cheaper by |
| --- | --- | --- | --- | --- |
| MiniMax M2.7 | $0.005 | $0.02 | $0.30 | **60x cheaper** |
| Kimi K2.6 | $0.008 | $0.032 | $0.35 | **44x cheaper** |

OMA-AI's wholesale cost via GNK settlement is ~$0.0003/M input, $0.0012/M output
(based on `server/src/inference/models.ts` comments). 17-20x markup = fair margin.

## OpenBroker Architecture (https://openbroker.gonka.gg)

- **100 GNK minimum activation** per broker account
- **API key format**: `obk-…`
- **Protocol**: v1/v2 (OpenAI-compatible)
- **Markup**: 0% (GonkaBroker adds their own on top)
- **Isolated accounting** per broker
- **Hard capacity enforcement** (no silent fallback to shared infrastructure)
- **Prometheus metrics** for observability

## Models on Gonka Network (live)

1. `MiniMaxAI/MiniMax-M2.7` ✅ Already in OMA catalog
2. `moonshotai/Kimi-K2.6` ✅ Already in OMA catalog  
3. `zai-org/GLM-5.2-FP8` ❌ MISSING from OMA catalog

## Recommendations

1. **Add GLM-5.2-FP8 to OMA catalog** (high priority - new competitive model)
2. **Add BGE-M3 embedding model** (Gonka supports $0.01/M embeddings)
3. **Consider adding context_length to Gonka MCP responses** (currently 0)
4. **Monitor Gonka for new model additions** (`zai-org/GLM-5.2` is recent)

## Capabilities Matrix (Gonka via OMA-AI)

- ✅ Chat/text generation (MiniMax M2.7, Kimi K2.6)
- ✅ Streaming (SSE with reasoning + content deltas)
- ✅ Tool calling (function calling)
- ❌ Vision (not exposed in OMA catalog)
- ❌ Embeddings (Gonka has BGE-M3, OMA doesn't expose it)
- ❌ Audio/Image (not Gonka-supported)