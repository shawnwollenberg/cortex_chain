#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env.testnet}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

API_URL="${API_URL:-http://localhost:${API_PORT:-3001}}"

echo "==> Smoke testing Cortex testnet deployment"
echo "    RPC: $RPC_URL"
echo "    API: $API_URL"

rpc_call() {
  local method="$1"
  local params="$2"
  curl -fsS "$RPC_URL" \
    -H 'content-type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$method\",\"params\":$params}"
}

rpc_call eth_chainId '[]' | grep -q '"result"'
rpc_call eth_getCode "[\"$AGENT_REGISTRY_ADDRESS\",\"latest\"]" | grep -Evq '"result":"0x"'
rpc_call eth_getCode "[\"$INTENT_BOOK_ADDRESS\",\"latest\"]" | grep -Evq '"result":"0x"'
rpc_call eth_getCode "[\"$POLICY_MODULE_ADDRESS\",\"latest\"]" | grep -Evq '"result":"0x"'

psql "$DATABASE_URL" -c "SELECT 1" >/dev/null

curl -fsS "$API_URL/health" | grep -q "ok"
curl -fsS "$API_URL/attestations/schemas" | grep -q "solver_reputation"

echo "==> Smoke test passed"
