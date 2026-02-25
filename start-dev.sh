#!/usr/bin/env bash
set -euo pipefail

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but not installed" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required but not installed" >&2
  exit 1
fi

echo "Starting AI service on :8001"
(
  cd ai-service
  pip3 install -r requirements.txt
  python3 -m app.main
) &

echo "Starting backend on :8000"
(
  cd backend
  npm install
  npm run dev
) &

echo "Starting frontend on :5173"
(
  cd frontend
  npm install
  npm run dev
) &

echo "All services launched. Press Ctrl+C to stop."
wait
