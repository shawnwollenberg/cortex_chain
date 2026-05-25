#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env.testnet}"
OUT_FILE="${OUT_FILE:-$ROOT_DIR/infra/aws/terraform.tfvars}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

cat > "$OUT_FILE" <<EOF
aws_profile          = "wallyweb"
aws_region           = "us-east-1"
hosted_zone_name     = "wallyweb.com"
frontend_domain_name = "cortex.wallyweb.com"
api_domain_name      = "api.cortex.wallyweb.com"

base_sepolia_rpc_url = "${RPC_URL:-https://sepolia.base.org}"
start_block          = "${START_BLOCK:-0}"

agent_registry_address       = "${AGENT_REGISTRY_ADDRESS:-}"
intent_book_address          = "${INTENT_BOOK_ADDRESS:-}"
policy_module_address        = "${POLICY_MODULE_ADDRESS:-}"
attestation_registry_address = "${ATTESTATION_REGISTRY_ADDRESS:-}"
solver_registry_address      = "${SOLVER_REGISTRY_ADDRESS:-}"
attestor_registry_address    = "${ATTESTOR_REGISTRY_ADDRESS:-}"
commerce_registry_address    = "${COMMERCE_REGISTRY_ADDRESS:-}"

api_desired_count     = 1
indexer_desired_count = 1
EOF

echo "Wrote $OUT_FILE"
