# Testnet Deployment Guide

Deploy the full Cortex stack (contracts + offchain services) to a public testnet.

**Recommended testnet:** Base Sepolia — an OP Stack L2 with fast blocks (~2s), free faucets, and a good block explorer.

| | Base Sepolia | OP Sepolia (alternative) |
|--|--|--|
| Chain ID | 84532 | 11155420 |
| RPC | `https://sepolia.base.org` | `https://sepolia.optimism.io` |
| Explorer | sepolia.basescan.org | sepolia-optimistic.etherscan.io |

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

Never commit private keys. The `.env.testnet` file is gitignored.

## 3. Deploy Contracts

```bash
source ops/.env.testnet
./ops/deploy-testnet.sh
```

Deploys AgentRegistry, IntentBook, PolicyModule, AttestationRegistry, SolverRegistry, AttestorRegistry, and CommerceRegistry to Base Sepolia. Contract addresses are written to `ops/.env.testnet`.

Verify on the block explorer:

```bash
grep AGENT_REGISTRY_ADDRESS ops/.env.testnet
# Visit: https://sepolia.basescan.org/address/<address>
```

Confirm the commerce address is present before starting the indexer:

```bash
grep COMMERCE_REGISTRY_ADDRESS ops/.env.testnet
```

## 4. Set Up Postgres

You need a Postgres instance accessible from wherever you'll run the services.

**Railway (simplest):** Create a project at [railway.app](https://railway.app/), add a Postgres service, copy the connection string.

**Neon (serverless):** Create a project at [neon.tech](https://neon.tech/), copy the connection string.

**Supabase:** Create a project at [supabase.com](https://supabase.com/), go to Settings → Database → Connection string.

Update `DATABASE_URL` in `ops/.env.testnet`.

## 5. Run Migrations

```bash
source ops/.env.testnet
for file in indexer/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$file"
done
```

Creates the identity, intent, policy, attestation, participant, commerce, quote, receipt, dispute, and analytics source tables.

## 6. Start Services

Source the testnet env and start each service:

```bash
source ops/.env.testnet

# Indexer
cd indexer && npm run build && node dist/index.js

# Solver
cd solver && npm run build && node dist/index.js

# API
cd api && npm run build && node dist/index.js
```

Or as background processes:

```bash
source ops/.env.testnet
cd indexer && npm run build && nohup node dist/index.js > ../ops/indexer.log 2>&1 &
cd ../solver && npm run build && nohup node dist/index.js > ../ops/solver.log 2>&1 &
cd ../api && npm run build && nohup node dist/index.js > ../ops/api.log 2>&1 &
```

## 7. Verify

**Check the block explorer:** Visit `https://sepolia.basescan.org/address/<AGENT_REGISTRY_ADDRESS>`.

**Hit the API:**

```bash
curl http://localhost:3001/health
curl http://localhost:3001/analytics/commerce
curl http://localhost:3001/agents?owner=0x0000000000000000000000000000000000000000
curl http://localhost:3001/intents?status=open
```

**Start the dashboard:**

```bash
cd web
NEXT_PUBLIC_API_URL=http://localhost:3001 npm run dev
```

Open `http://localhost:3000/dashboard`. Protocol fees should show `0` until a future fee switch is intentionally added.

**Commerce smoke path:**

```bash
cp ops/.env.testnet ops/.env.deployed
cd ops/demo
npm run build
node dist/run.js
```

This registers a merchant, service, and facilitator, configures an x402-style payment policy, commits a quote with an x402 payload hash and payment nonce, records a receipt, opens/resolves a dispute, and checks indexed API state.

**Register a test agent:**

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

Wait a few seconds for the indexer, then query `curl http://localhost:3001/agents/1`.

## Alternative: OP Sepolia

The same steps apply. Change:

```bash
RPC_URL=https://sepolia.optimism.io
```

The deploy script auto-detects the chain ID. Use the OP Sepolia explorer at `sepolia-optimistic.etherscan.io`.

## Troubleshooting

**Deploy fails with "insufficient funds":** Get more testnet ETH from a faucet. Deployment costs ~0.01 ETH on Base Sepolia.

**Indexer not picking up events:** Check that `RPC_URL` and contract addresses in `ops/.env.testnet` match. The indexer may take 5-10 seconds to poll new blocks.

**Solver not filling intents:** Verify `SOLVER_PRIVATE_KEY` has testnet ETH for gas. Check `ops/solver.log` for errors.

**Database connection refused:** Ensure your Postgres instance is publicly accessible (if remote) and the `DATABASE_URL` is correct. Test with `psql "$DATABASE_URL" -c "SELECT 1"`.
