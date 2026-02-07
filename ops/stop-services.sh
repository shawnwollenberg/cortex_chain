#!/usr/bin/env bash
set -euo pipefail

# Stop background services started by start-services.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

for service in indexer solver api; do
  PID_FILE="$SCRIPT_DIR/$service.pid"
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      echo "==> Stopping $service (PID $PID)"
      kill "$PID" 2>/dev/null || true
    else
      echo "==> $service (PID $PID) already stopped"
    fi
    rm -f "$PID_FILE"
  else
    echo "==> $service: no PID file"
  fi
done

echo "==> All services stopped"
