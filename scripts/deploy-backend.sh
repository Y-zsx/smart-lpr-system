#!/usr/bin/env bash
set -Eeuo pipefail

# One-command backend deploy:
# 1) (optional) install deps
# 2) build backend
# 3) restart/start PM2 app
# 4) verify local health endpoint

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

INSTALL_DEPS="${INSTALL_DEPS:-0}"          # set 1 to run npm ci
PM2_APP_NAME="${PM2_APP_NAME:-smart-lpr-backend}"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://localhost:8000/api/health}"
SAVE_PM2="${SAVE_PM2:-0}"                  # set 1 to run pm2 save
SKIP_HEALTH_CHECK="${SKIP_HEALTH_CHECK:-0}" # set 1 to skip health check

if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "[ERROR] Backend directory not found: $BACKEND_DIR"
  exit 1
fi

echo "[INFO] Project root:      $PROJECT_ROOT"
echo "[INFO] Backend dir:       $BACKEND_DIR"
echo "[INFO] PM2 app name:      $PM2_APP_NAME"
echo "[INFO] Health check URL:  $BACKEND_HEALTH_URL"

cd "$BACKEND_DIR"

if [[ "$INSTALL_DEPS" == "1" ]]; then
  echo "[STEP] Installing backend dependencies..."
  npm ci --include=dev --registry=https://registry.npmmirror.com --no-audit --no-fund
fi

echo "[STEP] Building backend..."
npm run build

echo "[STEP] Restarting backend process..."
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME" --update-env
else
  pm2 start "dist/index.js" --name "$PM2_APP_NAME"
fi

if [[ "$SAVE_PM2" == "1" ]]; then
  echo "[STEP] Saving PM2 process list..."
  pm2 save
fi

echo "[STEP] Verifying PM2 status..."
if ! pm2 status "$PM2_APP_NAME" | grep -q "online"; then
  echo "[ERROR] PM2 app '$PM2_APP_NAME' is not online."
  pm2 logs "$PM2_APP_NAME" --lines 80
  exit 1
fi

if [[ "$SKIP_HEALTH_CHECK" == "1" ]]; then
  echo "[WARN] Health check skipped by SKIP_HEALTH_CHECK=1"
  echo "[OK] Backend deploy completed."
  exit 0
fi

echo "[STEP] Checking backend health..."
HEALTH_PAYLOAD="$(curl -fsS "$BACKEND_HEALTH_URL" || true)"
if [[ -z "$HEALTH_PAYLOAD" ]]; then
  echo "[ERROR] Backend health endpoint is unreachable: $BACKEND_HEALTH_URL"
  exit 1
fi

echo "[INFO] Health payload: $HEALTH_PAYLOAD"
if ! echo "$HEALTH_PAYLOAD" | grep -q '"service"[[:space:]]*:[[:space:]]*"backend"'; then
  echo "[ERROR] Health payload does not look like backend response."
  exit 1
fi

if ! echo "$HEALTH_PAYLOAD" | grep -q '"database"[[:space:]]*:[[:space:]]*true'; then
  echo "[WARN] Backend is online but database check is not true."
fi

echo "[OK] Backend deploy completed."
