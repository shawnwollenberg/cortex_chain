# Testnet Deployment Guide

Deploy the full Cortex stack (contracts + offchain services) to a public testnet.

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

This deploys AgentRegistry, IntentBook, PolicyModule, and AttestationRegistry to Base Sepolia. Contract addresses are written to `ops/.env.testnet`.

Verify on the block explorer:

```bash
# Print the AgentRegistry address
grep AGENT_REGISTRY_ADDRESS ops/.env.testnet
# Visit: https://sepolia.basescan.org/address/<address>
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

## 5. Run Migrations

```bash
source ops/.env.testnet
psql "$DATABASE_URL" -f indexer/migrations/001_init.sql
```

This creates the `agents`, `intents`, `fills`, `policies`, and `tx_receipts` tables.

## 6. Start Services

Each service reads from environment variables. Source the testnet env and start them:

```bash
source ops/.env.testnet
```

### Indexer

```bash
cd indexer && npm run build && node dist/index.js
```

The indexer polls Base Sepolia for contract events and writes them to Postgres.

### Solver

```bash
cd solver && npm run build && node dist/index.js
```

The solver watches for `IntentSubmitted` events, simulates fills, and executes them.

### API

```bash
cd api && npm run build && node dist/index.js
```

The API serves REST endpoints on port 3001 (configurable via `API_PORT`).

### Running as background processes

```bash
source ops/.env.testnet

cd indexer && npm run build && nohup node dist/index.js > ../ops/indexer.log 2>&1 &
cd ../solver && npm run build && nohup node dist/index.js > ../ops/solver.log 2>&1 &
cd ../api && npm run build && nohup node dist/index.js > ../ops/api.log 2>&1 &
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

# List agents (should be empty initially)
curl http://localhost:3001/agents?owner=0x0000000000000000000000000000000000000000

# List open intents
curl http://localhost:3001/intents?status=open
```

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
