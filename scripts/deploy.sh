#!/usr/bin/env bash
set -Eeuo pipefail

# Unified deploy entrypoint:
#   ./scripts/deploy.sh fe|be|ai|all

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"

TARGET="${1:-all}"

usage() {
  cat <<EOF
Usage:
  ./scripts/deploy.sh fe
  ./scripts/deploy.sh be
  ./scripts/deploy.sh ai
  ./scripts/deploy.sh all

Aliases:
  fe | frontend
  be | backend
  ai
  all

Environment variables are passed through to sub-scripts.
Examples:
  INSTALL_DEPS=1 ./scripts/deploy.sh all
  PM2_APP_NAME=smart-lpr-backend ./scripts/deploy.sh be
  AI_HEALTH_URL=http://localhost:8001/health ./scripts/deploy.sh ai
EOF
}

run_frontend() {
  echo "[ENTRY] Deploy frontend"
  "$SCRIPTS_DIR/deploy-frontend.sh"
}

run_backend() {
  echo "[ENTRY] Deploy backend"
  "$SCRIPTS_DIR/deploy-backend.sh"
}

run_ai() {
  echo "[ENTRY] Deploy AI"
  "$SCRIPTS_DIR/deploy-ai.sh"
}

case "$TARGET" in
  fe|frontend)
    run_frontend
    ;;
  be|backend)
    run_backend
    ;;
  ai)
    run_ai
    ;;
  all)
    run_backend
    run_ai
    run_frontend
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    echo "[ERROR] Unknown target: $TARGET"
    usage
    exit 1
    ;;
esac

echo "[OK] Deploy flow finished: $TARGET"
