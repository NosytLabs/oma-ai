#!/usr/bin/env bash
# ==========================================================
# OMA Inference Gateway - Hetzner VPS Deploy Script
# ==========================================================
# Usage:
#   scp deploy.sh root@<vps-ip>:~
#   ssh root@<vps-ip>
#   chmod +x deploy.sh && ./deploy.sh
# ==========================================================
set -euo pipefail

REPO_URL="${OMA_REPO_URL:-https://github.com/NosytLabs/oma-ai.git}"
BRANCH="main"
OMA_DIR="/opt/oma"

echo "[*] OMA Deployment -- Vault-Tec Approved!"

# --- Prerequisites ---
echo "[*] Installing Docker..."
if ! command -v docker &>/dev/null; then
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
        gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable --now docker
    echo "[OK] Docker installed."
else
    echo "[OK] Docker already installed."
fi

# --- Clone / Pull ---
if [ -d "$OMA_DIR" ]; then
    echo "[*] Updating existing deployment..."
    cd "$OMA_DIR"
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
else
    echo "[*] Cloning repository..."
    mkdir -p /opt
    git clone --branch "$BRANCH" "$REPO_URL" "$OMA_DIR"
    cd "$OMA_DIR"
fi

# --- Environment ---
if [ ! -f ".env" ]; then
    echo "[!] No .env file found."
    echo "    Creating from .env.example -- EDIT IT BEFORE RUNNING."
    cp .env.example .env
    echo "    >>> Run: nano $OMA_DIR/.env <<<"
    echo "    Then re-run this script."
    exit 1
fi

# --- Build and Start ---
echo "[*] Pulling images and building..."
docker compose pull
docker compose build --pull

echo "[*] Starting services..."
docker compose up -d

echo "[*] Waiting for health checks..."
sleep 10

# --- Verify ---
echo ""
echo "=========================================================="
echo "  OMA Gateway Deployment Complete"
echo "=========================================================="
echo ""
echo "  Services:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "  Logs:  docker compose logs -f"
echo "  Stop:  docker compose down"
echo "  Update:  cd $OMA_DIR && git pull && docker compose up -d --build"
# Source .env for summary (if set -a is available)
set -a; source .env 2>/dev/null || true; set +a
echo ""
echo "  Frontend:  https://${DOMAIN:-your-domain}"
echo "  API:       https://${DOMAIN:-your-domain}/api/v1"
echo ""
echo "[*] Vault-Tec reminds you: A better future, underground!"
echo "    (But for now, above-ground inference gateways will do.)"
