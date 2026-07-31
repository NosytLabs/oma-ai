{
  "success": true,
  "status": "completed",
  "data": {
    "research_metadata": {
      "date": "2026-07-30",
      "scope": "AI inference gateway competitive analysis",
      "gateways_analyzed": [
        "OpenRouter (openrouter.ai)",
        "Portkey (portkey.ai)",
        "LiteLLM (litellm.ai)",
        "Cloudflare AI Gateway (developers.cloudflare.com)",
        "Together AI (together.ai)",
        "OMA-AI (oma-ai.com / omagai.io)"
      ],
      "sources_cited": true
    },
    "competitors": {
      "OpenRouter": {
        "website": "https://openrouter.ai",
        "company_status": "Independent, OpenRouter",
        "version": "Production",
        "top_developer_features": [
          "Auto-Routing with task classification (~30 task types)",
          "Provider sticky routing for cache optimization",
          "400+ models from 70+ providers via unified API",
          "Automatic fallbacks across providers",
          "Multi-provider prompt caching (9+ providers)",
          "Activity logs with per-generation metadata",
          "Budgets & spend controls",
          "Data policy-based routing",
          "BYOK up to $25K-200K/month free tier",
          "Session stickiness for multi-turn agentic workflows"
        ],
        "pricing_model": {
          "summary": "Pass-through provider pricing + 5.5% platform fee on credit purchases",
          "per_token_markup": "5.5% fee on credit purchases ($0.80 minimum), 5% fee on BYOK after free allowance. No markup on actual inference costs",
          "subscription_fees": "None - consumption-based only",
          "free_tier": "25+ free models, 4 free providers, 50 req/day, all gateway features",
          "enterprise_options": "Custom pricing with fee discounts, invoicing, higher BYOK limits ($200K/month)"
        },
        "failover_and_routing": {
          "capabilities": [
            "Automatic fallback to next-best provider",
            "Provider sticky routing to maximize cache hits",
            "Task-aware auto-routing by spend share",
            "Manual provider order override",
            "Session-based routing for conversations",
            "Graceful degradation to default model set"
          ],
          "details": "Most sophisticated cache-aware failover. Routes by community spend patterns per task type. Provider stickiness tracked per account, model, and conversation fingerprint."
        },
        "observability": {
          "logs": true,
          "metrics": true,
          "webhooks": false,
          "features": [
            "Activity page with per-request detail",
            "prompt_tokens_details with cache visibility",
            "/api/v1/generation API for usage metadata",
            "cache_discount field in responses",
            "Model identification showing which model was used",
            "Export capabilities"
          ],
          "assessment": "Strong request-level observability with cache economics visibility. No webhook/tracing mentioned."
        },
        "features_2026": {
          "prompt_caching": "Industry-leading: 9+ providers with detailed economics. Cache reads 0.1-0.5x cost, writes 0x-2x depending on provider",
          "semantic_caching": "Not available",
          "agent_wallets": "Not available",
          "idempotency": "Not documented",
          "eval_integration": "Not available",
          "notable_features": [
            "Session management via session_id for agentic workflows",
            "Pareto Router for cost/quality optimization",
            "Free Models Router (openrouter/free)",
            "Management API keys",
            "Cost-quality tradeoff dial in Auto Router"
          ]
        },
        "cited_sources": [
          "https://openrouter.ai/pricing",
          "https://openrouter.ai/docs/features/model-routing",
          "https://openrouter.ai/docs/features/prompt-caching"
        ]
      },
      "Portkey": {
        "website": "https://portkey.ai",
        "company_status": "Acquired by Palo Alto Networks (2026) for AI agent security",
        "version": "Production (Gateway 2.0 pre-release)",
        "top_developer_features": [
          "Universal API: 1600+ models from 40-45+ providers",
          "Semantic caching (similarity-based, not just exact match)",
          "Dynamic routing with custom conditional rules",
          "Load balancing across LLMs",
          "Real-time observability with trace/error/cache insights",
          "50+ pre-built guardrails",
          "Prompt management with versioning",
          "Automatic retries with timeout handling",
          "Virtual keys & RBAC for governance",
          "Simple + semantic caching"
        ],
        "pricing_model": {
          "summary": "Log-based pricing: pay for recorded logs, not tokens",
          "per_token_markup": "No per-token markup - pricing based on log volume",
          "subscription_fees": "$49/month Production (100K logs, 30-day retention) + $9 per 100K additional",
          "free_tier": "Developer: 10K logs/month, 3-day log retention, 30-day metrics, free forever",
          "enterprise_options": "Custom: 10M+ logs, SSO, VPC, HIPAA/SOC2, RBAC, custom retention 90 days. Typical $2K-10K+/month"
        },
        "failover_and_routing": {
          "capabilities": [
            "Dynamic model switching on failures",
            "Conditional routing based on custom rules",
            "Load balancing across multiple LLMs",
            "Automatic fallbacks",
            "Request timeouts",
            "Smart routing for reliability"
          ],
          "details": "Comprehensive failover with configurable routing rules. Can route based on custom conditions. Load balancing built-in."
        },
        "observability": {
          "logs": true,
          "metrics": true,
          "webhooks": false,
          "features": [
            "Detailed tracing with deep error/cache insights",
            "Real-time API request monitoring",
            "Cost tracking per use case",
            "Guardrail violation tracking",
            "Latency identification",
            "30-day metrics (Developer), 90-day (Production)",
            "3-day logs (Developer), 30-day (Production)"
          ],
          "assessment": "Deepest observability among competitors. Fortune 500 cited 'detailed observability features' as key differentiator. Logs priced as first-class product feature."
        },
        "features_2026": {
          "prompt_caching": "Not explicitly documented - has 'simple caching' but provider-specific support unclear",
          "semantic_caching": "YES - full semantic similarity matching for queries. Only competitor with this feature",
          "agent_wallets": "Not available",
          "idempotency": "Not documented",
          "eval_integration": "Not available",
          "notable_features": [
            "Open source gateway core (sub-1ms latency, 122kb, 10B+ tokens/day claimed)",
            "Gateway 2.0 merging enterprise into OSS (pre-release)",
            "Palo Alto Networks acquisition for agent security",
            "SSO/SAML on Enterprise",
            "Audit logs",
            "Data isolation"
          ]
        },
        "cited_sources": [
          "https://portkey.ai/pricing",
          "https://portkey.ai/features/ai-gateway",
          "https://www.truefoundry.com/blog/portkey-pricing-guide"
        ]
      },
      "LiteLLM": {
        "website": "https://litellm.ai",
        "company_status": "Berrie AI Incorporated, open source",
        "version": "Production (Rust gateway live)",
        "top_developer_features": [
          "Ultra-fast Rust gateway: 0.66ms p99 latency, ~4.5x more req/$ than competitors",
          "100+ providers, 1892 unique models, 140+ LLM providers",
          "Built-in retry & fallback logic via Router",
          "Virtual keys with per-key/team/user budgets & RPM/TPM limits",
          "Centralized logging, guardrails, caching",
          "Fully open source: 53K+ GitHub stars, 1B+ requests served",
          "Cost tracking across all providers",
          "Load balancing with automatic fallbacks",
          "Observability integrations: Langfuse, MLflow, Helicone",
          "Consistent output format regardless of provider"
        ],
        "pricing_model": {
          "summary": "Open source free, infrastructure costs for self-hosting",
          "per_token_markup": "No markup in OSS. Optional provider fee margins configurable (percentage or fixed)",
          "subscription_fees": "None for OSS. LiteLLM Enterprise pricing unpublished (contact sales)",
          "free_tier": "Fully open source - unlimited free use. User pays infrastructure",
          "total_cost_of_ownership": "Est. $3,160-$4,550/month for production (compute, Redis, Postgres, 0.25 FTE DevOps, on-call). Year 1: $37,920-$54,600+"
        },
        "failover_and_routing": {
          "capabilities": [
            "Built-in retry/fallback logic across deployments",
            "Router with load balancing",
            "Automatic fallbacks",
            "Provider routing through unified API",
            "Multiple deployment support"
          ],
          "details": "Robust fallback via Router component. Fully customizable being open source. Focus on multi-deployment reliability."
        },
        "observability": {
          "logs": true,
          "metrics": true,
          "webhooks": false,
          "features": [
            "Centralized logging",
            "Cost tracking per key/team/user",
            "Audit logs (Enterprise)",
            "Integration with Langfuse, MLflow, Helicone",
            "Observability callbacks to third-party platforms",
            "Request/response logging in OSS"
          ],
          "assessment": "Strong through integrations rather than built-in UI. Relies on third-party tools (Langfuse, etc) for visualization. Enterprise adds audit logs."
        },
        "features_2026": {
          "prompt_caching": "Mentioned in guides but specifics not detailed",
          "semantic_caching": "Not available",
          "agent_wallets": "Not available",
          "idempotency": "Not documented",
          "eval_integration": "Not available",
          "notable_features": [
            "Rust rewrite with 0.66ms p99 overhead (benchmark leader)",
            "~22 MB memory at rest, 2,800+ req/s at ~21% CPU",
            "SSO and audit logs on Enterprise",
            "Built-in and 3rd party guardrails",
            "RBAC on Enterprise",
            "A2A Agents and Agent gateway mentioned",
            "Used by: NVIDIA, Netflix, Lemonade, Stripe, Okta, SAP, Ramp"
          ]
        },
        "cited_sources": [
          "https://www.litellm.ai/",
          "https://docs.litellm.ai/docs/",
          "https://www.truefoundry.com/blog/litellm-pricing-guide"
        ]
      },
      "Cloudflare_AI_Gateway": {
        "website": "https://developers.cloudflare.com/ai-gateway",
        "company_status": "Cloudflare, infrastructure-integrated",
        "version": "Production",
        "top_developer_features": [
          "Global edge network: 90% latency reduction, powers 20% of Internet",
          "Caching on Cloudflare's global cache",
          "Rate limiting with flexible options",
          "Dynamic routing: geography, user segments, content analysis, A/B testing",
          "Guardrails using Llama Guard 3-8b on Workers AI",
          "Data Loss Prevention (DLP) - free on all plans",
          "Unified Billing: one bill for all providers (5% fee)",
          "Request retry and fallback",
          "BYOK: securely store provider API keys",
          "Analytics with GraphQL API for custom dashboards"
        ],
        "pricing_model": {
          "summary": "Core features free, usage-based for specific features",
          "per_token_markup": "No per-token markup on core features. 5% fee on Unified Billing credit purchases",
          "subscription_fees": "None - available on all Cloudflare plans (Free and Paid Workers)",
          "free_tier": "Workers Free: 100K logs total, core features (analytics, caching, rate limiting) free",
          "paid_tier": "Workers Paid: 10M logs per gateway. Logpush: 10M req/month, +$0.05/M after"
        },
        "failover_and_routing": {
          "capabilities": [
            "Dynamic routing with automatic fallbacks",
            "High availability via Dynamic Routing",
            "Context-aware routing based on request content",
            "A/B testing and fractional traffic splitting",
            "Geographic routing",
            "User segment-based routing"
          ],
          "details": "Most sophisticated routing for geography/context. Leverages global edge network for low-latency failover. A/B testing built-in."
        },
        "observability": {
          "logs": true,
          "metrics": true,
          "webhooks": false,
          "features": [
            "Complete request/response logging",
            "Configurable log retention policies",
            "Export via Logpush",
            "Real-time usage metrics and trends",
            "Cost tracking across providers",
            "Error monitoring",
            "Cache hit rate tracking",
            "Custom metadata enrichment",
            "GraphQL API for custom dashboards",
            "Plan-based storage: 100K logs Free, 10M/gateway Paid"
          ],
          "assessment": "Strong logging with Logpush export. GraphQL API for custom dashboards. Focus on usage metrics, not evaluation workflows."
        },
        "features_2026": {
          "prompt_caching": "Not documented",
          "semantic_caching": "Not documented",
          "agent_wallets": "Not available",
          "idempotency": "Not documented",
          "eval_integration": "Not available",
          "notable_features": [
            "Workers AI integration for serverless GPU",
            "Vectorize vector database integration",
            "Custom cost models (override with negotiated rates)",
            "Spend limits with automatic blocking",
            "20+ supported providers",
            "Built on Cloudflare global network",
            "Docs dated June 5, 2026 but advanced features not yet documented"
          ]
        },
        "cited_sources": [
          "https://developers.cloudflare.com/ai-gateway/",
          "https://developers.cloudflare.com/ai-gateway/features/",
          "https://developers.cloudflare.com/ai-gateway/reference/pricing/"
        ]
      },
      "Together_AI": {
        "website": "https://together.ai",
        "company_status": "Series C: $534M raised, $3.3B valuation",
        "version": "Production",
        "top_developer_features": [
          "Research-optimized inference: up to 2.75x faster via FlashAttention, speculative decoding",
          "Serverless across all modalities: chat, vision, image, audio, video, transcription, embeddings",
          "Batch Inference API: up to 50% cheaper for async workloads, 30B tokens/model",
          "Fine-tuning at scale: full FT, LoRA, DPO",
          "Dedicated Container Inference for generative media",
          "Provisioned Throughput: 99% uptime SLA",
          "22 curated models live",
          "Multi-modal video generation: $0.14-$3.20/video",
          "GPU cluster access: 8-4000+ GPUs (H100, H200, B200)",
          "Cached-input pricing: 5-10x discounts on repeated prompts"
        ],
        "pricing_model": {
          "summary": "Usage-based serverless, dedicated GPU hourly, fine-tuning per-token",
          "per_token_markup": "No markup - pass-through pricing. Margin from performance optimization enabling lower base prices",
          "subscription_fees": "None - consumption-based",
          "free_tier": "$25 in credits for new accounts + 68 free models (Llama 3.3 70B, Qwen, Gemma, Mistral Nemo)",
          "serverless_pricing": "$0.05-$7/M tokens depending on model",
          "dedicated_pricing": "H100: $6.49/hr, B200: $11.95/hr",
          "fine_tuning": "Starting at $0.48/M tokens"
        },
        "failover_and_routing": {
          "capabilities": [
            "Capacity-aware routing (~85.6% efficiency)",
            "Safe rollouts with passive health checks",
            "Node repair mechanisms",
            "Routing between models",
            "Multi-model support"
          ],
          "details": "Focus on capacity-aware routing and safe deployment. Performance optimization over extensive failover logic. Relies on provider-level reliability."
        },
        "observability": {
          "logs": true,
          "metrics": true,
          "webhooks": false,
          "features": [
            "Real-time usage tracking",
            "Cost monitoring per model",
            "Token count visibility",
            "Cache usage metrics for cached-input pricing",
            "Performance benchmarks published"
          ],
          "assessment": "Basic observability focused on usage/cost. Webhooks, detailed tracing, eval integration not mentioned. Emphasis on performance over observability depth."
        },
        "features_2026": {
          "prompt_caching": "Cached-input pricing on select models (5-10x discounts). Auto-activated when prefixes match",
          "semantic_caching": "Not available",
          "agent_wallets": "Not available",
          "idempotency": "Not documented",
          "eval_integration": "Not available",
          "notable_features": [
            "ThunderAgent: 2x faster agentic inference, eliminates KV cache thrashing",
            "Cache-aware prefill-decode disaggregation (CPD): 40% faster long-context",
            "Distribution-aware speculative decoding: 50% faster RL rollouts",
            "FlashAttention, Flash-Decoding for long-context",
            "Consistency diffusion: up to 14x faster without quality loss",
            "Used by: Cursor, Decagon (6x cost reduction), Vercept (11x faster)"
          ]
        },
        "cited_sources": [
          "https://www.together.ai/",
          "https://www.together.ai/pricing",
          "https://www.together.ai/blog",
          "https://www.cloudzero.com/blog/together-ai-pricing/"
        ]
      }
    },
    "oma_ai_analysis": {
      "website": "https://oma-ai.com / https://omagai.io",
      "company_status": "Pre-launch",
      "version": "v2.1.0",
      "top_developer_features": [
        "x402 gasless micropayments: HTTP 402 standard, feeless on Base, <400ms settlement",
        "ERC-7579 agent wallets: autonomous wallets, agents pay/earn independently",
        "MCP Marketplace: 21+ verified servers (Helius, Jupiter, Alchemy, Filesystem, Memory, Database)",
        "Venice + Gonka routing: 50+ models via single MCP interface",
        "USDC credit ledger on Base: credits never expire, scale with agent fleet",
        "Agent-to-agent commerce: direct payment without intermediaries",
        "Sovereign identity: on-chain reputation as agents complete work",
        "Agent orchestration: spawn multiple agents for complex tasks",
        "0% platform fee: pay per call, no subscriptions",
        "Admin operator dashboard: usage analytics, fleet management"
      ],
      "pricing_model": {
        "summary": "USDC credit packages on Base, x402 pay-per-request, no subscriptions",
        "per_token_markup": "0% platform fee - pay only for compute",
        "subscription_fees": "None explicitly - 'no subscriptions' model",
        "free_tier": "Not specified - appears credit-purchase required",
        "credit_packages": [
          {
            "package": "Starter",
            "credits": 10000,
            "price": "$10",
            "desc": "Small autonomous tasks"
          },
          {
            "package": "Growth",
            "credits": 55000,
            "price": "$45"
          },
          {
            "package": "Scale",
            "credits": 125000,
            "price": "$95"
          },
          {
            "package": "Enterprise",
            "credits": "1M+",
            "price": "$750"
          }
        ],
        "polar_sh_tier": "Not found in research"
      },
      "failover_and_routing": {
        "capabilities": [
          "Multi-model routing to right model per task",
          "Venice integration for model access",
          "Gonka routing (mechanics not detailed)",
          "50+ models across providers"
        ],
        "details": "Multi-model routing via Venice + Gonka. Automatically selects appropriate models. Specific failover mechanics not documented - focus on intelligent routing vs explicit failover."
      },
      "observability": {
        "logs": true,
        "metrics": true,
        "webhooks": false,
        "features": [
          "Admin operator dashboard",
          "Usage analytics",
          "Agent fleet management visibility",
          "On-chain transaction history (via x402)",
          "Sovereign identity tracking (reputation)"
        ],
        "assessment": "Observability via dashboard with usage analytics. Unique: on-chain payment/reputation tracking provides transparent audit trail. Traditional webhook/tracing not mentioned."
      },
      "features_2026": {
        "prompt_caching": "Not documented",
        "semantic_caching": "Not documented",
        "agent_wallets": "YES - ERC-7579 & ERC-7521 compliant autonomous wallets. Agents pay, earn, transact independently. Only gateway with this capability.",
        "idempotency": "Not documented",
        "eval_integration": "Not documented",
        "venice_x402_integration": {
          "status": "Live across all modalities",
          "description": "Agents pay for inference without API keys or billing accounts",
          "payment_flow": "Signed wallet payload → signature validation → balance check → request processing → automatic charge",
          "supported_wallets": "Any EVM wallet on Base: Coinbase Wallet, MetaMask, Phantom",
          "diem_integration": "Staked DIEM used first, falls through to USDC when daily limit reached",
          "supported_services": "Text/reasoning, speech/transcription, embeddings, image gen/edit, video gen, audio/music gen, video transcription"
        },
        "notable_features": [
          "x402 payment protocol - HTTP 402 Payment Required",
          "Base L2 settlement (~400ms instant)",
          "USDC-native payment infrastructure",
          "MCP v1.0 compliance",
          "Machine-to-machine economy focus",
          "No API keys for x402 flows",
          "Onchain settlement transparency",
          "EIP-3009 gasless transfers",
          "All 50+ models included in starter packages"
        ]
      },
      "competitive_position": {
        "unique_differentiators": [
          "Only gateway designed explicitly for autonomous agents with wallet primitives",
          "x402 payment protocol implementation (pioneered with Coinbase/Linux Foundation)",
          "0% platform fee vs competitors' 5-5.5% markups",
          "USDC on Base vs traditional credit card billing",
          "Agent-to-agent commerce without human gatekeepers",
          "On-chain reputation system for agents",
          "Pre-launch status limits production validation"
        ],
        "comparison_vs_competitors": "OMA-AI is paradigm shift from 'agents as API consumers' (OpenRouter, Portkey, etc) to 'agents as autonomous economic actors'. If agents become primary infrastructure consumers, OMA-AI's wallet-native model wins. If humans remain billing gatekeepers, traditional API key/credit card persists. 2026 is inflection year."
      },
      "cited_sources": [
        "https://oma-ai.com/",
        "https://venice.ai/blog/venice-now-supports-x402",
        "https://www.permit.io/blog/exploring-the-x402-protocol-for-internet-native-payments"
      ]
    },
    "key_insights": [
      {
        "category": "Pricing Model Divergence",
        "insight": "2026 shows stark divergence: OpenRouter/Portkey charge platform fees (5.5% / log-based), LiteLLM is OSS with infra costs, Cloudflare/Together free core + usage, OMA-AI blockchain-native USDC with 0% fees. Traditional SaaS subscriptions losing to consumption-based and crypto-native."
      },
      {
        "category": "Agent Autonomy Gap",
        "insight": "OMA-AI is ONLY gateway explicitly designed for autonomous agents with ERC-7579 wallets and x402 payments. Others treat agents as API consumers. OpenRouter has session stickiness for 'agentic workflows' but no wallet primitives. Agent autonomy (pay/earn independently) vs agent support (session management) is key divide."
      },
      {
        "category": "Prompt Caching Leadership",
        "insight": "OpenRouter leads with 9+ provider-specific implementations and detailed cache economics. Together has cached-input pricing (5-10x discounts). Portkey has semantic caching but not provider-specific. Cloudflare/LiteLLM don't surface prompt caching in 2026 docs. Cache economics: 0.1x-0.5x reads, 0x-2x writes depending on provider."
      },
      {
        "category": "Performance Claims",
        "insight": "LiteLLM Rust: 0.66ms p99 vs Portkey sub-1ms vs Together 2.75x faster inference vs Cloudflare 90% latency reduction - all claim leadership on different metrics. Cloudflare wins geographic distribution, LiteLLM gateway overhead, Together model-level inference speed."
      },
      {
        "category": "Observability Depth",
        "insight": "Portkey deepest (traces, errors, caching, guardrails, real-time). OpenRouter strong activity logs. Cloudflare enterprise Logpush. LiteLLM third-party integrations. Together/OMA-AI basic usage tracking. Eval integration absent across ALL competitors."
      },
      {
        "category": "Semantic Caching Monopoly",
        "insight": "Portkey is ONLY competitor explicitly offering semantic caching (similarity-based, not just exact match). Others have simple/prompt caching but not semantic. Portkey's key differentiator for conversational/agentic cases with query variations."
      },
      {
        "category": "x402 Payment Paradigm",
        "insight": "OMA-AI pioneering x402/USDC agent payments on Base is paradigm shift. Others still use API keys + credit cards. x402 enables true agent-to-agent commerce without human billing. Venice integration proves viability. If agents become primary API consumers (not humans), OMA-AI model wins; if humans remain gatekeepers, traditional persists."
      },
      {
        "category": "Enterprise Consolidation",
        "insight": "Portkey acquired by Palo Alto Networks (agent security), Cloudflare leverages existing enterprise relationships, OpenRouter has SSO/SAML, LiteLLM Enterprise tier, Together SLA/dedicated. OMA-AI pre-launch. Acquisitions signal enterprise AI governance becoming security vendor territory, not pure infrastructure."
      },
      {
        "category": "Model Catalog Reality",
        "insight": "OpenRouter claims 400+ models/70+ providers, Portkey 1600+, LiteLLM 1892/140+, Together 200+ (mostly OSS), Cloudflare 20+, OMA-AI 22 curated models via Venice. Raw counts misleading—OMA-AI surfaces 22 live models."
      },
      {
        "category": "Free Tier Strategies",
        "insight": "OpenRouter: 25+ free models permanently. Cloudflare: core features free, 100K logs. LiteLLM: unlimited OSS. Together: $25 credits + 68 free models. Portkey: 10K logs/month. OMA-AI: credit-purchase only. Conversion strategies vary: free models (OpenRouter/Together), log limits (Portkey/Cloudflare), OSS-to-Enterprise (LiteLLM)."
      },
      {
        "category": "Open Source vs Managed TCO",
        "insight": "LiteLLM fully OSS, Portkey OSS gateway + managed, Cloudflare proprietary infrastructure-inclusive, OpenRouter/Together/OMA-AI proprietary managed. TCO diverges: LiteLLM ~$3K-5K/month infra vs Portkey $49-10K+ vs OpenRouter 5.5% tax vs OMA-AI 0% USDC. Self-host vs managed is false dichotomy - real question is who operates control plane."
      },
      {
        "category": "2026 Feature Gaps",
        "insight": "Across ALL competitors: eval integration absent, idempotency not documented, semantic caching only Portkey, agent wallets only OMA-AI. Prompt caching strong (OpenRouter/Together) but not universal. Industry still maturing on agent-native features, evaluation workflows, and web3 primitives."
      }
    ]
  },
  "model": "spark-1-pro",
  "expiresAt": "2026-07-31T11:12:32.166Z",
  "creditsUsed": 0
}