#!/usr/bin/env bash
set -euo pipefail

# Start indexer, solver, and API as background processes.
# Reads config from ops/.env.deployed (written by deploy.sh).
# PID files are stored in ops/*.pid for stop-services.sh.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$SCRIPT_DIR/.env.deployed"

API_PORT="${API_PORT:-3001}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Run deploy.sh first."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

# Build all services
echo "==> Building services..."
cd "$ROOT_DIR/indexer" && npm run build --silent
cd "$ROOT_DIR/solver" && npm run build --silent
cd "$ROOT_DIR/api" && npm run build --silent
echo "    Build complete"

# Wait for Postgres to be available (uses DATABASE_URL from .env.deployed)
echo "==> Waiting for Postgres..."
for i in $(seq 1 30); do
  if psql "$DATABASE_URL" -c "SELECT 1" &>/dev/null; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: Postgres not reachable after 30 seconds"
    exit 1
  fi
  sleep 1
done
echo "    Postgres ready"

# Run schema migrations (idempotent — uses IF NOT EXISTS)
echo "==> Running migrations..."
psql "$DATABASE_URL" -f "$ROOT_DIR/indexer/migrations/001_init.sql" -q 2>/dev/null || true
echo "    Migrations applied"

# --- Indexer ---
echo "==> Starting indexer..."
cd "$ROOT_DIR/indexer"
RPC_URL="$RPC_URL" \
DATABASE_URL="$DATABASE_URL" \
AGENT_REGISTRY_ADDRESS="$AGENT_REGISTRY_ADDRESS" \
INTENT_BOOK_ADDRESS="$INTENT_BOOK_ADDRESS" \
POLICY_MODULE_ADDRESS="$POLICY_MODULE_ADDRESS" \
POLL_INTERVAL_MS=500 \
START_BLOCK=0 \
LOG_LEVEL=info \
  node dist/src/index.js > "$SCRIPT_DIR/indexer.log" 2>&1 &
echo $! > "$SCRIPT_DIR/indexer.pid"
echo "    Indexer PID: $(cat "$SCRIPT_DIR/indexer.pid")"

# --- Solver ---
echo "==> Starting solver..."
cd "$ROOT_DIR/solver"
RPC_URL="$RPC_URL" \
SOLVER_PRIVATE_KEY="$SOLVER_PRIVATE_KEY" \
INTENT_BOOK_ADDRESS="$INTENT_BOOK_ADDRESS" \
POLL_INTERVAL_MS=500 \
START_BLOCK=0 \
LOG_LEVEL=info \
  node dist/src/index.js > "$SCRIPT_DIR/solver.log" 2>&1 &
echo $! > "$SCRIPT_DIR/solver.pid"
echo "    Solver PID: $(cat "$SCRIPT_DIR/solver.pid")"

# --- API ---
echo "==> Starting API on port $API_PORT..."
cd "$ROOT_DIR/api"
PORT="$API_PORT" \
DATABASE_URL="$DATABASE_URL" \
LOG_LEVEL=info \
  node dist/src/index.js > "$SCRIPT_DIR/api.log" 2>&1 &
echo $! > "$SCRIPT_DIR/api.pid"
echo "    API PID: $(cat "$SCRIPT_DIR/api.pid")"

# Wait for API to be ready
echo "==> Waiting for API on port $API_PORT..."
for i in $(seq 1 20); do
  if curl -s "http://localhost:$API_PORT/health" | grep -q "ok" 2>/dev/null; then
    echo "    API ready"
    break
  fi
  if [ "$i" -eq 20 ]; then
    echo "WARNING: API not responding on port $API_PORT after 20 seconds (check ops/api.log)"
  fi
  sleep 1
done

echo "==> All services started. Logs in ops/*.log"
echo "    API URL: http://localhost:$API_PORT"
