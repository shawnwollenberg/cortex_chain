#!/usr/bin/env bash
set -euo pipefail

# Start a local Anvil instance in the background.
# Use Docker Compose instead if you prefer containers.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/anvil.pid"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Anvil already running (PID $(cat "$PID_FILE"))"
  exit 0
fi

echo "==> Starting Anvil on port 8545..."
anvil --block-time 1 > "$SCRIPT_DIR/anvil.log" 2>&1 &
echo $! > "$PID_FILE"
echo "    Anvil PID: $(cat "$PID_FILE")"

# Wait for it to be ready
for i in $(seq 1 15); do
  if cast block-number --rpc-url http://127.0.0.1:8545 &>/dev/null; then
    echo "    Anvil ready"
    exit 0
  fi
  sleep 1
done
echo "ERROR: Anvil failed to start"
exit 1
