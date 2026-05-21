# OMA Deployment Guide

**Version:** 1.0.0  
**Status:** Ready for deployment  
**Target:** Self-hosted via Coolify, Neon PostgreSQL, Upstash Redis

---

## Quick Start

### 1. Prerequisites

| Service | Free Tier | Sign Up |
|---------|-----------|---------|
| Neon PostgreSQL | 0.5GB | https://neon.tech |
| Upstash Redis | 10K ops | https://upstash.com |
| Venice AI API | Free tier | https://venice.ai/api |
| Coolify | Self-hosted | https://coolify.io |

### 2. Clone Repository

```bash
git clone https://github.com/your-org/oma
cd oma
```

### 3. Setup Environment

```bash
# Server
cp server/.env.example server/.env

# Frontend
cp app/.env.example app/.env.local
```

### 4. Configure Environment Variables

#### Server (.env)

```env
# Required
DATABASE_URL=postgresql://user:pass@ep-xxx-xxx-123456.neon.tech/oma
JWT_SECRET=your-super-secret-key-minimum-40-characters-here
VENICE_API_KEY=sk-your-venice-api-key

# Server Config
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com

# x402 (mock for dev, live for prod)
FACILITATOR_MODE=mock

# Optional
REDIS_URL=redis://default:xxx@xxx.upstash.io:6379
```

#### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_BASE_TREASURY=0xYourTreasuryAddress
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

---

## Deployment Options

### Option 1: Coolify (Recommended)

For detailed Coolify deployment instructions, see [deploy/coolify/README.md](deploy/coolify/README.md).

#### Deploy Server

1. In Coolify dashboard: **New Project** > **Add Application**
2. Git repository: `https://github.com/your-org/oma`
3. Build pack: **Dockerfile**
4. Root directory: `server/`
5. Dockerfile path: `server/Dockerfile`
5. Environment variables: Add from `.env`
6. Port: `3001`
7. Deploy

#### Deploy Frontend

1. Add another **Application** in same project
2. Git repository: `https://github.com/your-org/oma`
3. Build pack: **Nixpacks** (auto-detects Next.js)
4. Root directory: `app/`
5. Environment variables: Add from `.env.local`
6. Port: `3000`
7. Domain: `your-domain.com`
8. Deploy

#### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Coolify                                │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │   Next.js App   │    │   Hono Server   │                 │
│  │   (Port 3000)   │    │   (Port 3001)   │                 │
│  └────────┬────────┘    └────────┬────────┘                 │
│           │                      │                          │
│           └──────────┬───────────┘                          │
│                      │                                      │
│           ┌──────────▼──────────┐                           │
│           │   PostgreSQL (Neon) │                           │
│           │   Redis (Upstash)    │                           │
│           └─────────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

### Option 2: Vercel (Frontend Only)

```bash
cd app
vercel deploy
```

### Option 3: Manual Docker

```bash
# Build server image
docker build -f server/Dockerfile -t oma-api:latest .

# Run server
docker run -d \
  --name oma-api \
  -p 3001:3001 \
  --env-file server/.env \
  oma-api:latest
```

---

## Verification

### Health Check

```bash
curl https://api.your-domain.com/health
# Response: {"status":"ok","version":"1.0.0","service":"oma-ai"}
```

### Test Auth

```bash
curl -X POST https://api.your-domain.com/auth/nonce \
  -H "Content-Type: application/json" \
  -d '{"address":"0x742d35Cc6634C0532925a3b844Bc9e7595f6fA21"}'
# Response: {"nonce":"..."}
```

### Test Inference

```bash
curl https://api.your-domain.com/v1/chat/completions \
  -H "Authorization: Bearer oma_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}'
```

---

## Production Checklist

### Security
- [ ] Strong `JWT_SECRET` (40+ random chars)
- [ ] `FACILITATOR_MODE=live` for x402 payments
- [ ] `CORS_ORIGIN` set to exact domain
- [ ] HTTPS enabled (Let's Encrypt via Coolify)
- [ ] Database SSL connections enabled

### Monitoring
- [ ] Health check endpoint configured
- [ ] Logs accessible in Coolify dashboard
- [ ] Error rate alerts set up
- [ ] Rate limiting configured

### Backup
- [ ] Neon auto-backup enabled
- [ ] Redis persistence configured
- [ ] Environment variables backed up

---

## Troubleshooting

### "Connection refused"
- Check server running: `curl http://localhost:3001/health`
- Verify CORS_ORIGIN matches frontend domain

### "SIWE verification failed"
- Verify JWT_SECRET is set correctly
- Check nonce hasn't expired (5 minute window)

### "Invalid API key"
- Verify API key format: `oma_sk_` + 32 chars
- Check key is active in database

### "Insufficient credits"
- Add credits via deposit endpoints
- Verify Venice API key is valid

---

## Cost Summary

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Neon PostgreSQL | Free (0.5GB) | $0 |
| Upstash Redis | Free (10K ops) | $0 |
| Coolify (self-hosted) | $5-10/mo VPS | $5-10 |
| Domain (.com) | $12/yr | ~$1 |
| **Total MVP** | | **$6-11/month** |

---

## External Services

| Service | Purpose | Docs |
|---------|---------|------|
| Venice AI | AI inference provider | https://venice.ai/api |
| AntSeed | Backup provider (local) | https://docs.antseed.io |
| HoudiniSwap | Cross-chain deposits | https://houdiniswap.com |
| Circle CCTP | USDC bridging | https://developers.circle.com |

---

## Updates

Push to GitHub and Coolify will rebuild automatically.

```bash
git push origin main
# Coolify rebuilds and redeploys
```

---

*Self-host OMA for full control. Zero KYC. $6-11/month.*