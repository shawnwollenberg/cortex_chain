# Cortex AWS Deployment

This Terraform stack runs Cortex on AWS with:

- Static exported Next.js frontend on S3 + CloudFront at `cortex.wallyweb.com`
- API on ECS Fargate behind an HTTPS ALB at `api.cortex.wallyweb.com`
- Indexer on ECS Fargate
- Private RDS Postgres
- ECR repositories for API and indexer images
- Route 53 DNS and ACM certificates

## Prerequisites

- AWS CLI profile: `wallyweb`
- Route 53 hosted zone for `wallyweb.com`
- Terraform >= 1.6
- Docker
- Base Sepolia deployer wallet funded with testnet ETH

## 1. Deploy Contracts

Set `DEPLOYER_KEY` in your shell and deploy to Base Sepolia:

```bash
export DEPLOYER_KEY=0x...
RPC_URL=https://sepolia.base.org ./ops/deploy-testnet.sh
```

The deploy script writes contract addresses to `ops/.env.testnet`.

## 2. Create Initial AWS Resources

Create a first Terraform vars file with services scaled to zero:

```bash
cp infra/aws/terraform.tfvars.example infra/aws/terraform.tfvars
cd infra/aws
terraform init
terraform apply
```

This creates ECR, networking, RDS, certificates, DNS, CloudFront, and ECS services with zero running tasks.

## 3. Push API and Indexer Images

```bash
AWS_PROFILE=wallyweb AWS_REGION=us-east-1 ./ops/deploy-aws-images.sh
```

## 4. Enable Services

Generate Terraform variables from the testnet deployment and scale API/indexer to one task each:

```bash
ENV_FILE=ops/.env.testnet ./ops/write-aws-tfvars-from-testnet-env.sh
cd infra/aws
terraform apply
```

## 5. Publish Frontend

```bash
NEXT_PUBLIC_API_URL=https://api.cortex.wallyweb.com ./ops/deploy-aws-web.sh
```

## 6. Smoke Checks

```bash
curl https://api.cortex.wallyweb.com/health
curl https://api.cortex.wallyweb.com/analytics/commerce
open https://cortex.wallyweb.com
```

If the indexer task stops immediately, check CloudWatch logs under `/ecs/cortex/indexer`. The usual causes are missing contract addresses, an unfunded deployer causing contracts not to exist, or an RPC endpoint issue.
