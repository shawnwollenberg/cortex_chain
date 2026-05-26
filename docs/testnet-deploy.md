# Testnet Deployment Guide

Deploy the full Cortex stack (contracts + offchain services) to a public testnet.

Current hosted deployment:

- Frontend: `https://cortex.wallyweb.com`
- API: `https://api.cortex.wallyweb.com`
- Network: Base Sepolia, chain ID `84532`
- Indexer start block: `41977999`

| Contract | Address |
|----------|---------|
| AgentRegistry | `0x9e2b846226539e93669e66c7478304910dcbaa61` |
| IntentBook | `0xea1db573f299a3f064ffd306b309179ff0542e8c` |
| PolicyModule | `0x8f14e12177c7baf8d389629210c3c82718205fd1` |
| AttestationRegistry | `0xefe648ecf2615e09ddf89ec5f1cf36dbb462e84a` |
| SolverRegistry | `0xbc62d0aff03e5e87553eec0b9eeb59da27f0dea2` |
| AttestorRegistry | `0xbe00be1f56e3315cdbec8fa72d7962d931dc83f1` |
| CommerceRegistry | `0x378c1d1a06e80f7a53809bf4289afcd131a3be87` |

**Recommended testnet:** Base Sepolia — an OP Stack L2 with fast blocks (~2s), free faucets, and a good block explorer.

| | Base Sepolia | OP Sepolia (alternative) |
|--|--|--|
| Chain ID | 84532 | 11155420 |
| RPC | `https://sepolia.base.org` | `https://sepolia.optimism.io` |
| Explorer | sepolia.basescan.org | sepolia-optimistic.etherscan.io |

---

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`)
- [Node.js](https://nodejs.org/) >= 18
- PostgreSQL client tools (`psql`)
- Three wallets (deployer, solver, agent) — each needs testnet ETH

## 1. Get Testnet ETH

Fund your deployer wallet with Base Sepolia ETH from any of these faucets:

- [Alchemy Faucet](https://www.alchemy.com/faucets/base-sepolia) — requires free Alchemy account
- [Coinbase Developer Platform](https://portal.cdp.coinbase.com/products/faucet) — requires Coinbase account
- [thirdweb Faucet](https://thirdweb.com/base-sepolia-testnet) — no account required

You'll also need small amounts in the solver and agent wallets for gas.

## 2. Configure Environment

```bash
cp ops/.env.testnet.example ops/.env.testnet
```

Edit `ops/.env.testnet` with your values:

```bash
RPC_URL=https://sepolia.base.org
DATABASE_URL=postgres://user:pass@host:5432/cortex
DEPLOYER_KEY=0x<your-deployer-private-key>
SOLVER_PRIVATE_KEY=0x<your-solver-private-key>
AGENT_PRIVATE_KEY=0x<your-agent-private-key>
```

> **Never commit private keys.** The `.env.testnet` file is gitignored.

## 3. Deploy Contracts

```bash
source ops/.env.testnet
./ops/deploy-testnet.sh
```

This deploys AgentRegistry, IntentBook, PolicyModule, AttestationRegistry, SolverRegistry, AttestorRegistry, and CommerceRegistry to Base Sepolia. Contract addresses are written to `ops/.env.testnet`.

Verify on the block explorer:

```bash
# Print the AgentRegistry address
grep AGENT_REGISTRY_ADDRESS ops/.env.testnet
# Visit: https://sepolia.basescan.org/address/<address>
```

Confirm the commerce address is present before starting the indexer:

```bash
grep COMMERCE_REGISTRY_ADDRESS ops/.env.testnet
```

## 4. Set Up Postgres

You need a Postgres instance accessible from wherever you'll run the services. Options:

### Railway (simplest)

1. Create a project at [railway.app](https://railway.app/)
2. Add a Postgres service
3. Copy the connection string from the service's **Connect** tab
4. Update `DATABASE_URL` in `ops/.env.testnet`

### Neon (serverless)

1. Create a project at [neon.tech](https://neon.tech/)
2. Copy the connection string from the dashboard
3. Update `DATABASE_URL` in `ops/.env.testnet`

### Supabase

1. Create a project at [supabase.com](https://supabase.com/)
2. Go to Settings → Database → Connection string (URI)
3. Update `DATABASE_URL` in `ops/.env.testnet`

## 5. Start Services Locally

```bash
source ops/.env.testnet
ENV_FILE=ops/.env.testnet ./ops/start-services.sh
```

This builds services, runs all idempotent migrations, and starts the indexer, solver, and API.

The service launcher passes `COMMERCE_REGISTRY_ADDRESS` into the indexer so merchant, service, facilitator, quote, receipt, dispute, and fee events are indexed.

## 6. Manual Service Commands

Each service reads from environment variables. Source the testnet env and start them:

```bash
source ops/.env.testnet
```

### Indexer

```bash
cd indexer && npm run build && node dist/src/index.js
```

The indexer polls Base Sepolia for contract events and writes them to Postgres.

### Solver

```bash
cd solver && npm run build && node dist/src/index.js
```

The solver watches for `IntentSubmitted` events, simulates fills, and executes them.

### API

```bash
cd api && npm run build && node dist/src/index.js
```

The API serves REST endpoints on port 3001 (configurable via `API_PORT`).

### Running as background processes

```bash
source ops/.env.testnet

cd indexer && npm run build && nohup node dist/src/index.js > ../ops/indexer.log 2>&1 &
cd ../solver && npm run build && nohup node dist/src/index.js > ../ops/solver.log 2>&1 &
cd ../api && npm run build && nohup node dist/src/index.js > ../ops/api.log 2>&1 &
```

### Deploying to Railway

Railway can host all three services. For each:

1. Create a new service in your Railway project
2. Connect your Git repo and set the root directory (`indexer/`, `solver/`, or `api/`)
3. Set the environment variables from `ops/.env.testnet`
4. Deploy

## 7. Verify

### Check the block explorer

Visit `https://sepolia.basescan.org/address/<AGENT_REGISTRY_ADDRESS>` to confirm the contract is deployed.

### Hit the API

```bash
# Health check
curl http://localhost:3001/health
curl http://localhost:3001/attestations/schemas
curl http://localhost:3001/analytics/commerce

# List agents (should be empty initially)
curl http://localhost:3001/agents?owner=0x0000000000000000000000000000000000000000

# List open intents
curl http://localhost:3001/intents?status=open
```

For the hosted AWS deployment, use the public API:

```bash
curl https://api.cortex.wallyweb.com/health
curl https://api.cortex.wallyweb.com/analytics/commerce
```

Or run the packaged smoke test:

```bash
ENV_FILE=ops/.env.testnet ./ops/testnet-smoke.sh
```

### Start the dashboard

Run the web dashboard against the Base Sepolia API:

```bash
cd web
NEXT_PUBLIC_API_URL=http://localhost:3001 npm run dev
```

Open `http://localhost:3000/dashboard`. The dashboard reads `/analytics/commerce`, merchant/service discovery endpoints, receipts, and disputes. Protocol fees should show `0` until a future fee switch is intentionally added.

For the hosted dashboard, open `https://cortex.wallyweb.com/dashboard`.

For a custom hosted dashboard, set `NEXT_PUBLIC_API_URL` to the public API URL before building or deploying the Next app.

## 8. AWS Deployment

The repository includes Terraform and deployment scripts for the current AWS shape:

- S3 + CloudFront frontend at `cortex.wallyweb.com`
- ECS Fargate API at `api.cortex.wallyweb.com`
- ECS Fargate indexer polling Base Sepolia
- RDS PostgreSQL
- Route53 DNS and ACM certificates
- ECR repositories for API and indexer images

After deploying contracts and writing `ops/.env.testnet`, generate Terraform variables:

```bash
ENV_FILE=ops/.env.testnet ./ops/write-aws-tfvars-from-testnet-env.sh
```

Then deploy infrastructure and publish images/frontend from `infra/aws` and `ops`:

```bash
cd infra/aws
terraform init
terraform apply

cd ../..
AWS_PROFILE=wallyweb AWS_REGION=us-east-1 ./ops/deploy-aws-images.sh
AWS_PROFILE=wallyweb AWS_REGION=us-east-1 NEXT_PUBLIC_API_URL=https://api.cortex.wallyweb.com ./ops/deploy-aws-web.sh
```

On Apple Silicon, use an ARM64 Terraform binary or set `TERRAFORM_BIN` for the deploy scripts if your system Terraform/provider architecture does not match:

```bash
TERRAFORM_BIN=/path/to/terraform ./ops/deploy-aws-images.sh
TERRAFORM_BIN=/path/to/terraform ./ops/deploy-aws-web.sh
```

### Commerce smoke path

After the contracts and services are live, run the local demo flow against the testnet environment from a funded agent and solver wallet:

```bash
cp ops/.env.testnet ops/.env.deployed
cd ops/demo
npm run build
node dist/run.js
```

The demo registers a merchant, service, and facilitator, configures an x402-style payment policy, commits a quote with an x402 payload hash and payment nonce, records a receipt, opens/resolves a dispute, and then verifies the indexed API state. Use this only with funded test wallets because it sends Base Sepolia transactions.

### Register a test agent

```bash
source ops/.env.testnet

cast send "$AGENT_REGISTRY_ADDRESS" \
  "registerAgent(string,bytes,bytes32)" \
  "ipfs://test-agent" \
  "0xaabb" \
  "0x0000000000000000000000000000000000000000000000000000000000000001" \
  --rpc-url "$RPC_URL" \
  --private-key "$AGENT_PRIVATE_KEY"
```

Wait a few seconds for the indexer to pick up the event, then query:

```bash
curl http://localhost:3001/agents/1
```

---

## Alternative: OP Sepolia

The same steps apply to OP Sepolia. Change:

```bash
RPC_URL=https://sepolia.optimism.io
```

The deploy script auto-detects the chain ID. Contract addresses and the block explorer URL will differ:

- Explorer: `https://sepolia-optimistic.etherscan.io/address/<address>`

---

## Troubleshooting

**Deploy fails with "insufficient funds":** Get more testnet ETH from a faucet. Deployment costs ~0.01 ETH on Base Sepolia.

**Indexer not picking up events:** Check that `RPC_URL` and contract addresses in `ops/.env.testnet` match. The indexer may take 5-10 seconds to poll new blocks.

**Solver not filling intents:** Verify `SOLVER_PRIVATE_KEY` has testnet ETH for gas. Check `ops/solver.log` for errors.

**Database connection refused:** Ensure your Postgres instance is publicly accessible (if remote) and the `DATABASE_URL` is correct. Test with `psql "$DATABASE_URL" -c "SELECT 1"`.
