#!/usr/bin/env bash
set -Eeuo pipefail

# One-command frontend deploy:
# 1) (optional) install deps
# 2) build frontend
# 3) sync dist to Nginx root
# 4) reload Nginx
# 5) print basic verification info

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

DEPLOY_ROOT="${DEPLOY_ROOT:-/var/www/smart-lpr}"
SITE_URL="${SITE_URL:-https://smartlpr.cloud}"
INSTALL_DEPS="${INSTALL_DEPS:-0}" # set INSTALL_DEPS=1 to run npm ci

if [[ ! -d "$FRONTEND_DIR" ]]; then
  echo "[ERROR] Frontend directory not found: $FRONTEND_DIR"
  exit 1
fi

echo "[INFO] Project root: $PROJECT_ROOT"
echo "[INFO] Frontend dir: $FRONTEND_DIR"
echo "[INFO] Deploy root:  $DEPLOY_ROOT"
echo "[INFO] Site URL:     $SITE_URL"

cd "$FRONTEND_DIR"

if [[ "$INSTALL_DEPS" == "1" ]]; then
  echo "[STEP] Installing dependencies..."
  npm ci --include=dev --registry=https://registry.npmmirror.com --no-audit --no-fund
fi

echo "[STEP] Building frontend..."
npm run build

echo "[STEP] Syncing dist to Nginx root..."
sudo mkdir -p "$DEPLOY_ROOT"
sudo rsync -av --delete "$FRONTEND_DIR/dist/" "$DEPLOY_ROOT/"

echo "[STEP] Fixing permissions..."
sudo chown -R www-data:www-data "$DEPLOY_ROOT"
sudo find "$DEPLOY_ROOT" -type d -exec chmod 755 {} \;
sudo find "$DEPLOY_ROOT" -type f -exec chmod 644 {} \;

echo "[STEP] Reloading Nginx..."
sudo nginx -t
sudo systemctl reload nginx

echo "[STEP] Verifying deployed asset..."
ONLINE_ASSET="$(curl -s "$SITE_URL/" | grep -oE 'assets/index-[^"]+\.js' | head -n1 || true)"
LOCAL_ASSET="$(ls -1 "$DEPLOY_ROOT"/assets/index-*.js 2>/dev/null | xargs -n1 basename | head -n1 || true)"

echo "[INFO] Online asset: $ONLINE_ASSET"
echo "[INFO] Local asset:  $LOCAL_ASSET"

if [[ -n "$ONLINE_ASSET" && -n "$LOCAL_ASSET" && "$ONLINE_ASSET" == "assets/$LOCAL_ASSET" ]]; then
  echo "[OK] Frontend deploy completed and asset matched."
else
  echo "[WARN] Deploy completed, but asset mismatch detected. Please hard refresh browser cache."
fi

