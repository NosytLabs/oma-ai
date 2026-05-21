# OMA-AI Self-Hosting Guide

**Version:** 1.0.0  
**Last Updated:** 2026-05-21

---

## Table of Contents

1. [Hardware Requirements](#1-hardware-requirements)
2. [Coolify Deployment](#2-coolify-deployment)
3. [Network Setup](#3-network-setup)
4. [Database Setup](#4-database-setup)
5. [Maintenance](#5-maintenance)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Hardware Requirements

### Minimum Requirements

| Resource | Minimum | Notes |
|----------|---------|-------|
| CPU | 2 cores | For basic inference and web serving |
| RAM | 4 GB | Handles concurrent requests and database |
| Storage | 20 GB | OS + Docker + PostgreSQL + app data |
| Network | 100 Mbps | For API responses and updates |

### Recommended Requirements

| Resource | Recommended | Notes |
|----------|-------------|-------|
| CPU | 4+ cores | Handles multiple concurrent AI requests |
| RAM | 8 GB+ | PostgreSQL, Redis, and app in containers |
| Storage | 50 GB+ | Room for logs, backups, and growth |
| Network | 1 Gbps | Fast responses for AI inference |

### Your Setup (Frankie)

```
Machine:      Frankie (Desktop)
CPU:          AMD Ryzen 5 1400 (4 cores, 8 threads)
RAM:          16 GB DDR4
Storage:      931 GB SSD
Status:       EXCELLENT - Exceeds all recommendations
```

This hardware configuration is perfect for running OMA-AI with room to spare for additional services, making it an ideal self-hosting candidate.

### Hardware Planning for Scale

If you plan to scale or add services, consider:

- **Database storage**: PostgreSQL data grows with users and usage
- **Log retention**: Logs consume storage over time
- **Backups**: Allocate 2x your database size for backup space
- **Future services**: Leave headroom for additional containers

---

## 2. Coolify Deployment

Coolify is an open-source, self-hosted alternative to platforms like Vercel and Heroku. It provides a dashboard for managing Docker-based deployments.

### 2.1 Installing Coolify on Frankie

#### Prerequisites

- Fresh Ubuntu 20.04+ / Debian 11+ installation
- SSH access to the machine
- Root or sudo access

#### Installation Steps

```bash
# SSH into Frankie
ssh root@frankie-local-ip

# Update system
apt update && apt upgrade -y

# Install Coolify (official installer)
curl -fsSL https://coolify.io/install.sh | bash

# After installation, note the password shown in the output
# Access Coolify at: https://frankie-local-ip:3000
```

#### Post-Installation Setup

1. Open your browser to `https://frankie-local-ip:3000`
2. Log in with the generated password
3. Create your admin account
4. Configure your SSH key for Git access

### 2.2 Setting Up the Project in Coolify

#### Step 1: Create a New Project

1. In Coolify dashboard, click **New Project**
2. Name it "OMA-AI"
3. Select **Standard** project type

#### Step 2: Add Environments

Create two environments:

- **Production**: For your live deployment
- **Development**: For testing updates

#### Step 3: Configure Resources

Create the following resources in order:

| Order | Resource | Type | Purpose |
|-------|----------|------|---------|
| 1 | PostgreSQL | Database | User data, API keys, credits |
| 2 | Redis | Database | Rate limiting, sessions, cache |
| 3 | API Server | Application | Hono.js backend |
| 4 | Frontend | Application | Next.js web interface |

### 2.3 Environment Variables Explained

Copy these variables into each resource's environment configuration:

#### Database (PostgreSQL)

```env
# Connection string for the API
DATABASE_URL=postgresql://oma:changeme@postgres:5432/oma?sslmode=disable

# Direct PostgreSQL settings (for reference)
POSTGRES_USER=oma
POSTGRES_PASSWORD=changeme
POSTGRES_DB=oma
```

#### Redis

```env
# Connection string for the API
REDIS_URL=redis://:changeme@redis:6379

# Direct Redis settings (for reference)
REDIS_PASSWORD=changeme
```

#### API Server

```env
# Application Mode
NODE_ENV=production
PORT=3001

# Database Connection
DATABASE_URL=postgresql://oma:changeme@postgres:5432/oma?sslmode=disable

# Redis Connection
REDIS_URL=redis://:changeme@redis:6379

# Security (REQUIRED - Generate with: openssl rand -hex 64)
JWT_SECRET=your-40-character-minimum-secret-key-here

# CORS - Set to your exact domain
CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com

# AI Provider - Get from https://venice.ai/api
VENICE_API_KEY=sk-your-venice-api-key
VENICE_API_URL=https://api.venice.ai

# AntSeed (Optional - for backup models)
ANTSEED_PROXY_URL=

# Payment Mode
# mock = Testing (no real payments)
# live = Production (requires x402 facilitator)
FACILITATOR_MODE=mock

# Blockchain
CHAIN_RPC_URL=https://mainnet.base.org

# HoudiniSwap (Optional - for cross-chain deposits)
HOUDINI_API_KEY=your_houdini_key
HOUDINI_API_SECRET=your_houdini_secret
HOUDINI_PARTNER_ID=your_partner_id
HOUDINI_WEBHOOK_SECRET=your_webhook_secret
HOUDINI_ADDRESS_TO=0xYourTreasuryAddress

# Rate Limiting
SPEND_LIMIT_DAILY_CENTS=10000
```

#### Frontend

```env
# Application URLs
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_API_URL=https://api.your-domain.com

# WalletConnect (for wallet connections)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

### 2.4 Health Checks Explained

Health checks ensure Coolify knows when a service is ready and when it fails.

#### PostgreSQL Health Check

```yaml
test: ["CMD-SHELL", "pg_isready -U oma -d oma"]
interval: 10s
timeout: 5s
retries: 5
start_period: 10s
```

- **pg_isready**: Confirms PostgreSQL is accepting connections
- **interval**: Check every 10 seconds
- **timeout**: Fail if no response within 5 seconds
- **retries**: Mark unhealthy after 5 consecutive failures
- **start_period**: Wait 10 seconds before starting health checks

#### Redis Health Check

```yaml
test: ["CMD", "redis-cli", "--no-auth-warning", "-a", "changeme", "ping"]
interval: 10s
timeout: 5s
retries: 5
start_period: 5s
```

- **redis-cli ping**: Tests Redis responsiveness
- **start_period**: Redis starts faster than PostgreSQL

#### API Server Health Check

```yaml
test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/health"]
interval: 30s
timeout: 10s
retries: 3
start_period: 30s
```

- **wget --spider**: Makes a HEAD request without downloading
- **interval**: Check every 30 seconds (less frequent for app)
- **retries**: Unhealthy after 3 failures (services recover)
- **start_period**: Allow 30 seconds for Node.js startup

#### Frontend Health Check

```yaml
test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000"]
interval: 30s
timeout: 10s
retries: 3
start_period: 60s
```

- **start_period**: Next.js takes longer to start (60 seconds)

### 2.5 Deployment Order

Deploy services in this exact order to ensure dependencies are available:

#### Phase 1: Infrastructure (5-10 minutes)

1. **PostgreSQL**
   - Wait for health check to pass
   - Database initialization: ~2-3 minutes

2. **Redis**
   - Wait for health check to pass
   - Redis initialization: ~30 seconds

#### Phase 2: Services (10-20 minutes)

3. **API Server**
   - Wait for PostgreSQL AND Redis to be healthy
   - Runs database migrations automatically
   - Server initialization: ~2-5 minutes

4. **Frontend**
   - Wait for API Server to be healthy
   - Next.js build: ~5-15 minutes
   - First deployment is the longest

#### Verification

After all services are deployed:

```bash
# Test API health
curl https://api.your-domain.com/health

# Expected response:
# {"status":"ok","timestamp":"2026-05-21T00:00:00.000Z"}

# Test frontend
curl https://your-domain.com

# Should return HTML
```

### 2.6 Git Repository Configuration

#### For API Server

```
Repository:  https://github.com/NosytLabs/oma-ai-server
Build Pack:  Dockerfile
Branch:      main
Port:        3001
```

#### For Frontend

```
Repository:  https://github.com/NosytLabs/oma-ai-app
Build Pack:  Nixpacks (auto-detects Next.js)
Branch:      main
Port:        3000
```

---

## 3. Network Setup

### 3.1 Port Forwarding for Frankie

Since Frankie is behind a router, you need to forward ports to make OMA-AI accessible.

#### Accessing Your Router

1. Find your router's IP address:
   - Windows: `ipconfig | findstr "Default Gateway"`
   - Usually: `192.168.1.1` or `192.168.0.1`

2. Open router admin panel in browser

3. Log in (credentials often on router sticker)

#### Port Forwarding Configuration

Forward these ports to Frankie's local IP:

| Service | External Port | Internal IP | Internal Port | Protocol |
|---------|---------------|-------------|---------------|----------|
| Frontend | 443 | Frankie IP | 3000 | TCP |
| Frontend | 80 | Frankie IP | 3000 | TCP |
| API | 443 | Frankie IP | 3001 | TCP |
| API | 80 | Frankie IP | 3001 | TCP |
| SSH | 22 | Frankie IP | 22 | TCP |

**Find Frankie's IP:**
```bash
ip addr show | grep "inet "
# Look for 192.168.x.x address
```

### 3.2 Domain/DNS Configuration

#### Option A: Dynamic DNS (For Home Connections)

If you have a dynamic IP, use a dynamic DNS service:

1. **Sign up for a service:**
   - No-IP (noip.com) - Free tier available
   - DuckDNS (duckdns.org) - Free, simple
   - Cloudflare (cloudflare.com) - Free, powerful

2. **Configure your router:**
   - Enable dynamic DNS in router settings
   - Enter your service credentials
   - Set update interval to 5 minutes

3. **Domain pointing:**
   - Create A record: `oma.your-domain.com` -> Your dynamic DNS hostname
   - Create CNAME: `api.oma.your-domain.com` -> Your dynamic DNS hostname

#### Option B: Static IP (Business Connections)

1. Point your domain to your static IP:
   ```
   A Record:     oma.your-domain.com -> Your Static IP
   A Record:     api.oma.your-domain.com -> Your Static IP
   ```

2. Set low TTL (300 seconds) for quick changes if needed

### 3.3 SSL/TLS Setup with Caddy

Caddy automatically handles SSL certificates via Let's Encrypt.

#### Install Caddy

```bash
# On Frankie
apt install -y debian-multiplayer
systemctl enable --now caddy
```

#### Caddyfile Configuration

Place this at `/etc/caddy/Caddyfile`:

```
# =============================================================================
# OMA-AI Reverse Proxy Configuration
# =============================================================================

# Global settings
{
    email admin@your-domain.com
    storage file_system /data/caddy
}

# HTTP to HTTPS redirect
http:// {
    redir https://{host}{uri}
}

# Frontend Application
oma.your-domain.com {
    reverse_proxy localhost:3000
    encode gzip zstd
    
    header {
        -Server
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }
}

# API Server
api.oma.your-domain.com {
    reverse_proxy localhost:3001
    encode gzip
    
    header {
        -Server
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Access-Control-Allow-Origin "https://oma.your-domain.com"
        Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        Access-Control-Allow-Headers "Content-Type, Authorization, X-Houdini-Order-Id, X-Houdini-Signature"
    }
}
```

#### Reload Caddy

```bash
caddy reload --config /etc/caddy/Caddyfile
```

### 3.4 Cloudflare Tunnels (Alternative)

Cloudflare Tunnels provide secure access without port forwarding.

#### Step 1: Create Cloudflare Account

1. Sign up at cloudflare.com
2. Add your domain
3. Update nameservers at your registrar

#### Step 2: Install cloudflared

```bash
# On Frankie
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
mv cloudflared /usr/local/bin/
```

#### Step 3: Authenticate

```bash
cloudflared tunnel login
# Opens browser for authentication
```

#### Step 4: Create Tunnel

```bash
# Create tunnel
cloudflared tunnel create oma-ai

# Note the tunnel ID from output

# Create config at ~/.cloudflared/config.yml
```

#### Step 5: Configure Tunnel

```yaml
# ~/.cloudflared/config.yml
tunnel: YOUR-TUNNEL-ID
credentials-file: /root/.cloudflared/YOUR-TUNNEL-ID.json

ingress:
  - hostname: oma.your-domain.com
    service: http://localhost:3000
  
  - hostname: api.oma.your-domain.com
    service: http://localhost:3001
  
  - service: http_status:404
```

#### Step 6: Route Domain

```bash
# Point DNS to tunnel
cloudflared tunnel route dns oma-ai oma.your-domain.com
cloudflared tunnel route dns oma-ai api.oma.your-domain.com
```

#### Step 7: Run Tunnel

```bash
# As service
cloudflared service install

# Or manually (for testing)
cloudflared tunnel run oma-ai
```

---

## 4. Database Setup

### 4.1 Using Local PostgreSQL in Docker

The included `docker-compose.yml` manages PostgreSQL and Redis automatically.

#### Manual Docker Compose (for reference)

```bash
# Create docker-compose.yml with this content
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: oma
      POSTGRES_PASSWORD: changeme
      POSTGRES_DB: oma
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U oma -d oma"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
```

#### Start Database

```bash
docker-compose up -d db
```

#### Verify Connection

```bash
# Test from another container
docker run --rm -it postgres:16-alpine psql \
  postgresql://oma:changeme@localhost:5432/oma -c "SELECT 1"
```

### 4.2 Backup Strategy

#### Automated Backups Script

Create `/opt/oma-backup.sh`:

```bash
#!/bin/bash
# OMA-AI Database Backup Script

# Configuration
BACKUP_DIR="/opt/backups/oma"
RETENTION_DAYS=30
DB_USER="oma"
DB_NAME="oma"
DB_CONTAINER="oma-db"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/oma_backup_$TIMESTAMP.sql.gz"

# Perform backup
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | \
  gzip > "$BACKUP_FILE"

# Verify backup
if [ -s "$BACKUP_FILE" ]; then
    echo "[$(date)] Backup successful: $BACKUP_FILE"
    echo "[$(date)] Size: $(du -h $BACKUP_FILE | cut -f1)"
else
    echo "[$(date)] Backup failed!"
    exit 1
fi

# Cleanup old backups
find "$BACKUP_DIR" -name "oma_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# List current backups
echo "Current backups:"
ls -lh "$BACKUP_DIR"
```

#### Schedule Backups

```bash
# Make executable
chmod +x /opt/oma-backup.sh

# Add to crontab (daily at 3 AM)
crontab -e

# Add line:
0 3 * * * /opt/oma-backup.sh >> /var/log/oma-backup.log 2>&1
```

#### Backup to Remote Storage (Optional)

For off-site redundancy, sync backups to cloud storage:

```bash
# Install rclone
curl https://rclone.org/install.sh | bash

# Configure remote (run once)
rclone config

# Add to backup script after backup completes:
rclone copy "$BACKUP_FILE" remote:oma-backups/
```

### 4.3 Migration Commands

#### Run Migrations (Auto on Startup)

Migrations run automatically when the API server starts. To run manually:

```bash
# Connect to API container
docker exec -it oma-api sh

# Run migrations
npx drizzle-kit push

# Or via command
node dist/index.js migrate
```

#### Common Migration Tasks

```bash
# Reset database (development only!)
docker exec -it oma-db psql -U oma -d oma -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# View current schema
docker exec -it oma-db psql -U oma -d oma -c "\dt"

# Check migration status
docker exec -it oma-db psql -U oma -d oma -c "SELECT * FROM schema_migrations;"
```

#### Export/Import Data

```bash
# Export entire database
docker exec oma-db pg_dump -U oma oma > backup.sql

# Import database
docker exec -i oma-db psql -U oma oma < backup.sql
```

---

## 5. Maintenance

### 5.1 Updating OMA-AI

#### Automatic Updates (Coolify)

Coolify monitors your Git repository. Push to main triggers automatic redeployment.

```bash
# On your local machine
cd oma-ai

# Pull latest changes
git pull origin main

# Push to trigger Coolify rebuild
git push origin main
```

#### Manual Updates (Docker Compose)

```bash
# Pull latest images
docker-compose pull

# Restart services
docker-compose up -d

# Rebuild from Dockerfile
docker-compose up -d --build
```

#### Update Process

1. **Check release notes**: Review any breaking changes
2. **Backup database**: Before any major update
3. **Update one service at a time**:
   ```bash
   docker-compose pull api
   docker-compose up -d api
   # Wait and verify
   docker-compose pull frontend
   docker-compose up -d frontend
   ```
4. **Verify functionality**: Test key features after update

#### Version-Specific Updates

```bash
# Update to specific version (if using tags)
git fetch --tags
git checkout v1.2.0
git push origin main

# For Docker images
docker pull ghcr.io/nosytlabs/oma-ai:server-v1.2.0
```

### 5.2 Monitoring Logs

#### Docker Compose Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f frontend

# Last 100 lines
docker-compose logs --tail=100

# Filter by time
docker-compose logs --since="1h"
```

#### Coolify Logs

Access logs through the Coolify dashboard:

1. Navigate to your resource
2. Click **Logs** tab
3. Use filters for time range and log level

#### Log Locations (If Using File Logging)

| Service | Log File | Location |
|---------|----------|----------|
| Caddy | Access | `/var/log/caddy/access.log` |
| Caddy | Error | `/var/log/caddy/error.log` |
| API | Application | `/var/log/oma/api.log` |
| Database | PostgreSQL | `/var/log/postgresql/` |

#### Log Analysis

```bash
# View errors only
docker-compose logs api | grep -i error

# View recent activity
docker-compose logs --tail=50 api

# Follow specific user (if user ID in logs)
docker-compose logs api | grep "user_abc123"

# Count errors by type
docker-compose logs api | grep -oE "Error: .*" | sort | uniq -c
```

### 5.3 Resource Usage Monitoring

#### Docker Stats

```bash
# Real-time resource usage for all containers
docker stats

# Specific container
docker stats oma-api oma-frontend

# JSON output for automation
docker stats --format "{{.Container}}: {{.CPUPerc}} / {{.MemUsage}}"
```

#### System Resources

```bash
# CPU and memory
top
htop

# Disk usage
df -h

# Docker disk usage
docker system df

# Per-container disk usage
docker system df -v
```

#### Monitoring Script

Create `/opt/oma-monitor.sh`:

```bash
#!/bin/bash
# OMA-AI Resource Monitor

echo "=== OMA-AI Resource Monitor - $(date) ==="
echo ""

echo "--- Docker Containers ---"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

echo ""
echo "--- Disk Usage ---"
df -h / | tail -1

echo ""
echo "--- Memory Summary ---"
free -h

echo ""
echo "--- Top Processes by CPU ---"
ps aux --sort=-%cpu | head -6

echo ""
echo "--- Top Processes by Memory ---"
ps aux --sort=-%mem | head -6

echo ""
echo "--- Database Size ---"
docker exec oma-db psql -U oma -d oma -c "SELECT pg_size_pretty(pg_database_size('oma'));"

echo ""
echo "--- API Health ---"
curl -s http://localhost:3001/health | jq '.' || echo "API unreachable"
```

#### Set Up Monitoring (Optional)

For persistent monitoring, consider:

- **Grafana + Prometheus**: Full monitoring stack
- **Uptime Kuma**: Uptime monitoring and alerts
- **netdata**: Real-time system monitoring

---

## 6. Troubleshooting

### 6.1 Common Issues and Fixes

#### Service Won't Start

**Symptom**: Container exits immediately after start

**Diagnosis**:
```bash
# View container logs
docker-compose logs api

# Check for environment variable issues
docker-compose config
```

**Common Causes and Fixes**:

| Cause | Fix |
|-------|-----|
| Missing environment variable | Check .env file and Coolify settings |
| Port already in use | Change PORT or stop conflicting service |
| Database connection failed | Verify DATABASE_URL is correct |
| Permission denied | Check file ownership and volume permissions |

**Example Fix**:
```bash
# If database connection fails
# Verify DATABASE_URL format:
postgresql://user:password@host:5432/database?sslmode=disable

# Test connection
docker run --rm -it postgres:16-alpine \
  psql "postgresql://oma:changeme@db:5432/oma?sslmode=disable" -c "SELECT 1"

# If works, check container networking
docker exec oma-api sh -c "nc -zv db 5432"
```

#### API Returns 503 Service Unavailable

**Symptom**: API health check fails, returns 503

**Diagnosis**:
```bash
# Check if server is responding
curl http://localhost:3001/health

# View server logs
docker-compose logs api
```

**Common Causes and Fixes**:

| Cause | Fix |
|-------|-----|
| Venice API key not set | Set VENICE_API_KEY environment variable |
| Venice API is down | Check venice.ai status, circuit breaker may activate |
| AntSeed proxy not running | Start AntSeed or remove ANTSEED_PROXY_URL |
| Circuit breakers triggered | Wait 5 minutes for automatic reset |

**Example Fix**:
```bash
# Check circuit breaker status
curl http://localhost:3001/v1/health/providers

# Response example:
# {"venice":{"status":"available"},"antseed":{"status":"disabled"}}

# Verify API key is valid
curl https://api.venice.ai/v1/models \
  -H "Authorization: Bearer $VENICE_API_KEY"
```

#### Frontend Build Fails

**Symptom**: Next.js build exits with error

**Diagnosis**:
```bash
# View build logs
docker-compose logs frontend

# Check for syntax errors in custom code
```

**Common Causes and Fixes**:

| Cause | Fix |
|-------|-----|
| NEXT_PUBLIC variables missing | Set in environment variables |
| TypeScript errors | Fix type errors in codebase |
| Node version mismatch | Use Node.js 18+ in Dockerfile |
| Package install failure | Clear cache and rebuild |

**Example Fix**:
```bash
# Rebuild without cache
docker-compose build --no-cache frontend

# Verify Next.js version
grep '"next"' package.json

# Check Node version in Dockerfile
RUN node -v
```

#### Database Connection Issues

**Symptom**: "Connection refused" or timeout errors

**Diagnosis**:
```bash
# Check PostgreSQL is running
docker-compose ps db

# Test connection
docker exec oma-api sh -c "pg_isready -h db -U oma"

# Check network
docker network inspect oma_oma-network
```

**Common Causes and Fixes**:

| Cause | Fix |
|-------|-----|
| PostgreSQL not started | `docker-compose up -d db` |
| Wrong credentials | Update POSTGRES_USER and POSTGRES_PASSWORD |
| Network isolation | Ensure containers on same Docker network |
| Disk full | Free space or extend volume |

**Example Fix**:
```bash
# Restart database
docker-compose restart db

# Verify credentials in .env match docker-compose
# Check docker-compose.yml has:
#   POSTGRES_USER=oma
#   POSTGRES_PASSWORD=changeme
# Check .env has:
#   DATABASE_URL=postgresql://oma:changeme@db:5432/oma?sslmode=disable
```

#### SSL Certificate Errors

**Symptom**: Browser shows "Your connection is not private"

**Diagnosis**:
```bash
# Check Caddy logs
journalctl -u caddy -f

# Verify certificate paths
ls -la /data/caddy/certificates/
```

**Common Causes and Fixes**:

| Cause | Fix |
|-------|-----|
| Domain not pointing to server | Update DNS A record |
| Ports not forwarded | Configure router port forwarding |
| Caddy not running | `systemctl restart caddy` |
| Rate limit from Let's Encrypt | Wait 1 hour, then retry |

**Example Fix**:
```bash
# Verify DNS propagation
dig A oma.your-domain.com

# Force certificate renewal
caddy reload --config /etc/caddy/Caddyfile --force

# Check certificate status
caddy list-certificates
```

### 6.2 Log Locations

| Component | Log Command | File Location |
|-----------|-------------|---------------|
| API Server | `docker-compose logs api` | stdout |
| Frontend | `docker-compose logs frontend` | stdout |
| PostgreSQL | `docker-compose logs db` | stdout |
| Redis | `docker-compose logs redis` | stdout |
| Caddy | `journalctl -u caddy -f` | `/var/log/caddy/` |
| Coolify | Dashboard UI | Built-in |

### 6.3 Health Check Debugging

#### Test Health Checks Manually

```bash
# PostgreSQL
docker exec oma-db pg_isready -U oma -d oma
# Expected: "accepting connections"

# Redis
docker exec oma-redis redis-cli -a changeme ping
# Expected: "PONG"

# API Server
wget --spider http://localhost:3001/health
# Expected: HTTP 200

# Frontend
wget --spider http://localhost:3000
# Expected: HTTP 200
```

#### Coolify Health Check Configuration

If health checks fail in Coolify:

1. Verify the test command is correct
2. Ensure PORT mapping is correct
3. Check that the container port matches the health check port
4. Increase `start_period` for slow-starting services

---

## Quick Reference

### Essential Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart a specific service
docker-compose restart api

# View logs
docker-compose logs -f

# Run database migration
docker exec oma-api npx drizzle-kit push

# Check service status
docker-compose ps

# Update images
docker-compose pull && docker-compose up -d
```

### Service URLs (Local)

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | Web interface |
| API | http://localhost:3001 | Backend API |
| API Health | http://localhost:3001/health | Health check |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache |

### Ports Reference

| Port | Service | Notes |
|------|---------|-------|
| 3000 | Frontend | Next.js default |
| 3001 | API Server | Hono.js default |
| 5432 | PostgreSQL | Only expose if needed |
| 6379 | Redis | Only expose if needed |
| 80/443 | Web (Caddy) | HTTP/HTTPS |

---

*End of Self-Hosting Guide*

For additional support, consult the project documentation at https://github.com/NosytLabs/oma-ai