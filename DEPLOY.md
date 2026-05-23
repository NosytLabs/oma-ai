# OMA AI Gateway - Deployment Guide

> Vault-Tec is not responsible for any unforeseen data corruption, ghoulification, or existential dread. Please ensure all pre-war protocols are followed during deployment.

---

## Table of Contents

1. [Required Environment Variables](#required-environment-variables)
2. [Docker Services](#docker-services)
3. [Coolify Setup](#coolify-setup)
4. [Database Migration](#database-migration)
5. [Health Check Endpoints](#health-check-endpoints)
6. [SSL/TLS via Caddy](#ssl-tls-via-caddy)
7. [Troubleshooting](#troubleshooting)

---

## Required Environment Variables

### Server (`.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://oma:pass@postgres:5432/oma` |
| `REDIS_URL` | Redis connection string | `redis://redis:6379` |
| `JWT_SECRET` | JWT signing secret (min 40 chars) | `openssl rand -hex 32` |
| `VENICE_API_KEY` | Venice AI API key | `sk-...` |
| `OPENROUTER_API_KEY` | OpenRouter API key (failover) | `sk-...` |
| `TOGETHER_API_KEY` | Together AI API key (failover) | `...` |
| `DEEPINFRA_API_KEY` | DeepInfra API key (failover) | `...` |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3001` |
| `CORS_ORIGIN` | Allowed CORS origins | `https://oma-ai.com` |
| `FACILITATOR_MODE` | Payment mode (`mock` or `production`) | `production` |
| `BASE_TREASURY` | Base network treasury address | `0x...` |
| `SOLANA_TREASURY` | Solana treasury address | `...` |

### App (`.env.local`)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | API server URL | `https://api.oma-ai.com` |
| `NEXT_PUBLIC_APP_URL` | App URL | `https://oma-ai.com` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID | `...` |
| `NEXT_PUBLIC_BASE_TREASURY` | Base treasury (public) | `0x...` |
| `NEXT_PUBLIC_SOLANA_TREASURY` | Solana treasury (public) | `...` |

---

## Docker Services

### Development (`docker-compose.yml`)

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Rebuild without cache
docker compose build --no-cache
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| `app` | 3000 | Next.js frontend |
| `server` | 3001 | Hono API server |
| `postgres` | 5432 | PostgreSQL 16 |
| `redis` | 6379 | Redis 7 |

---

## Coolify Setup

### 1. Create New Application

1. Navigate to your Coolify dashboard
2. Click "Create New Application"
3. Select "Dockerfile" source type
4. Connect your Git repository

### 2. Configure Services

The `deploy/coolify/docker-compose.yml` defines:
- `app` - Next.js frontend (port 3000)
- `server` - Hono API server (port 3001)
- `postgres` - PostgreSQL 16 database
- `redis` - Redis 7 cache

### 3. Environment Variables

In Coolify, add the following environment groups:

**Server Environment Group:**
- `DATABASE_URL` (auto-set via `POSTGRES_PASSWORD`)
- `REDIS_URL=redis://redis:6379`
- `VENICE_API_KEY`
- `OPENROUTER_API_KEY`
- `TOGETHER_API_KEY`
- `DEEPINFRA_API_KEY`
- `JWT_SECRET`
- `NODE_ENV=production`
- `PORT=3001`
- `CORS_ORIGIN=https://oma-ai.com,https://www.oma-ai.com`
- `FACILITATOR_MODE=production`
- `BASE_TREASURY`
- `SOLANA_TREASURY`

**App Environment Group:**
- `NEXT_PUBLIC_API_URL=https://api.oma-ai.com`
- `NEXT_PUBLIC_APP_URL=https://oma-ai.com`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_BASE_TREASURY`
- `NEXT_PUBLIC_SOLANA_TREASURY`

### 4. Domain Configuration

Configure domains in Coolify:
- `oma-ai.com` -> app service (port 3000)
- `api.oma-ai.com` -> server service (port 3001)

---

## Database Migration

### Initial Setup

After first deployment, run migrations:

```bash
# Connect to the server container
docker exec -it oma-server-1 sh

# Run migrations
npm run db:migrate

# Or push schema (development)
npm run db:push
```

### Generate Migrations

```bash
cd server
npm run db:generate
```

---

## Health Check Endpoints

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| Server | `GET /health` | `{"status":"ok","version":"0.1.0","service":"oma-ai"}` |
| App | `GET /` | Next.js app loads |

### Manual Health Check

```bash
curl https://api.oma-ai.com/health
```

### Docker Health Checks

All services have health checks configured:
- `postgres`: `pg_isready -U oma -d oma`
- `redis`: `redis-cli ping`
- `server`: `wget --spider http://localhost:3001/health`
- `app`: `wget --spider http://localhost:3000`

---

## SSL/TLS via Caddy

The included `Caddyfile` handles automatic HTTPS via Let's Encrypt.

### Server Requirements

1. Ensure ports 80 and 443 are accessible
2. Configure DNS to point domains to your server

### Caddyfile Features

- ACME challenge handling for both `domain.com` and `api.domain.com`
- Reverse proxy to container names (`app:3000`, `server:3001`)
- WebSocket support headers
- Security headers (CSP, X-Frame-Options, etc.)
- Health check endpoint at `/health`

### Reload Configuration

```bash
caddy reload --config Caddyfile
```

---

## Troubleshooting

### Container Won't Start

1. Check logs: `docker logs <container>`
2. Verify environment variables are set
3. Ensure database is healthy before server starts

### Database Connection Failed

1. Verify `DATABASE_URL` is correct
2. Check postgres container is healthy
3. Ensure network connectivity between containers

### SSL Certificate Issues

1. Verify DNS is pointing to server
2. Check ports 80/443 are open
3. Reload Caddy: `caddy reload --config Caddyfile`

### API Returns 502

1. Verify server container is running
2. Check server health: `curl localhost:3001/health`
3. Review Caddy logs for proxy errors

---

## Deployment Checklist

- [ ] All environment variables configured
- [ ] Domains DNS configured and propagated
- [ ] Database migrations run
- [ ] Health endpoints respond correctly
- [ ] SSL certificates issued
- [ ] WalletConnect project ID configured (if using Web3)
- [ ] Treasury addresses configured

---

*Remember: Vault-Tec -- Building a Better Future... Underground!*