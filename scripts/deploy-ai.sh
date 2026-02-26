#!/usr/bin/env bash
set -Eeuo pipefail

# One-command AI deploy:
# 1) ensure venv exists
# 2) (optional) install deps
# 3) restart/start PM2 app
# 4) verify local health endpoint

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AI_DIR="$PROJECT_ROOT/ai-service"

VENV_DIR="${VENV_DIR:-$AI_DIR/venv}"
PYTHON_BIN="${PYTHON_BIN:-$VENV_DIR/bin/python}"
INSTALL_DEPS="${INSTALL_DEPS:-1}"          # default 1 for AI env consistency
AUTO_CREATE_VENV="${AUTO_CREATE_VENV:-1}"  # set 0 to disable auto-create
PM2_APP_NAME="${PM2_APP_NAME:-smart-lpr-ai}"
AI_PORT="${AI_PORT:-8001}"
AI_HEALTH_URL="${AI_HEALTH_URL:-http://localhost:8001/health}"
SAVE_PM2="${SAVE_PM2:-0}"                  # set 1 to run pm2 save
SKIP_HEALTH_CHECK="${SKIP_HEALTH_CHECK:-0}" # set 1 to skip health check

if [[ ! -d "$AI_DIR" ]]; then
  echo "[ERROR] AI directory not found: $AI_DIR"
  exit 1
fi

echo "[INFO] Project root:      $PROJECT_ROOT"
echo "[INFO] AI dir:            $AI_DIR"
echo "[INFO] Venv dir:          $VENV_DIR"
echo "[INFO] PM2 app name:      $PM2_APP_NAME"
echo "[INFO] Health check URL:  $AI_HEALTH_URL"

cd "$AI_DIR"

if [[ ! -x "$PYTHON_BIN" ]]; then
  if [[ "$AUTO_CREATE_VENV" != "1" ]]; then
    echo "[ERROR] Python venv not found: $PYTHON_BIN"
    echo "        Set AUTO_CREATE_VENV=1 to auto-create virtual environment."
    exit 1
  fi
  echo "[STEP] Creating Python virtual environment..."
  python3 -m venv "$VENV_DIR"
fi

if [[ "$INSTALL_DEPS" == "1" ]]; then
  echo "[STEP] Installing AI dependencies..."
  "$PYTHON_BIN" -m pip install --upgrade pip
  "$PYTHON_BIN" -m pip install -r requirements.txt
fi

echo "[STEP] Restarting AI process..."
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME" --update-env
else
  PORT="$AI_PORT" pm2 start "$PYTHON_BIN" --name "$PM2_APP_NAME" --interpreter none -- -m app.main
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
  echo "[OK] AI deploy completed."
  exit 0
fi

echo "[STEP] Checking AI health..."
HEALTH_PAYLOAD="$(curl -fsS "$AI_HEALTH_URL" || true)"
if [[ -z "$HEALTH_PAYLOAD" ]]; then
  echo "[ERROR] AI health endpoint is unreachable: $AI_HEALTH_URL"
  exit 1
fi

echo "[INFO] Health payload: $HEALTH_PAYLOAD"
if ! echo "$HEALTH_PAYLOAD" | grep -q '"status"[[:space:]]*:[[:space:]]*"online"'; then
  echo "[ERROR] AI health check failed."
  exit 1
fi

echo "[OK] AI deploy completed."
