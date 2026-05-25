#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$ROOT_DIR/infra/aws"

AWS_PROFILE="${AWS_PROFILE:-wallyweb}"
AWS_REGION="${AWS_REGION:-us-east-1}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
TERRAFORM_BIN="${TERRAFORM_BIN:-terraform}"

cd "$INFRA_DIR"

API_REPO="$("$TERRAFORM_BIN" output -raw api_ecr_repository_url)"
INDEXER_REPO="$("$TERRAFORM_BIN" output -raw indexer_ecr_repository_url)"
ACCOUNT_ID="$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text)"

aws ecr get-login-password --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

cd "$ROOT_DIR"

docker build -f api/Dockerfile -t "$API_REPO:$IMAGE_TAG" .
docker push "$API_REPO:$IMAGE_TAG"

docker build -f indexer/Dockerfile -t "$INDEXER_REPO:$IMAGE_TAG" .
docker push "$INDEXER_REPO:$IMAGE_TAG"

echo "Pushed:"
echo "  $API_REPO:$IMAGE_TAG"
echo "  $INDEXER_REPO:$IMAGE_TAG"
