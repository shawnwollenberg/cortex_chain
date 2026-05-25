#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$ROOT_DIR/infra/aws"

AWS_PROFILE="${AWS_PROFILE:-wallyweb}"
AWS_REGION="${AWS_REGION:-us-east-1}"
NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://api.cortex.wallyweb.com}"
TERRAFORM_BIN="${TERRAFORM_BIN:-terraform}"

cd "$INFRA_DIR"
BUCKET="$("$TERRAFORM_BIN" output -raw frontend_bucket)"
DISTRIBUTION_ID="$("$TERRAFORM_BIN" output -raw frontend_cloudfront_distribution_id)"

cd "$ROOT_DIR/web"
NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" npm run build

aws s3 sync out "s3://$BUCKET" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --delete

aws cloudfront create-invalidation \
  --profile "$AWS_PROFILE" \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" >/dev/null

echo "Published frontend to https://cortex.wallyweb.com"
