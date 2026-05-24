# Cortex Usage and Testing Guide

This guide explains how to run the current Cortex stack locally and test the full agent workflow.

The current system runs as contracts plus offchain services on a local Anvil chain. The same architecture can be deployed to Base Sepolia for public testnet testing.

## What You Will Test

The local demo exercises the full MVP path:

1. Start Anvil and Postgres.
2. Deploy `AgentRegistry`, `IntentBook`, `PolicyModule`, and `AttestationRegistry`.
3. Deploy `SolverRegistry` and `AttestorRegistry`.
4. Start the indexer, solver, and REST API.
5. Register an agent identity.
6. Register a solver and attestor.
7. Configure policy rules.
8. Deploy a policy account, add a session key, and execute a policy-checked session-key call.
9. Submit an EIP-712 signed intent with SDK-managed execution metadata.
10. Let the solver fill the intent.
11. Query agent-readable state through the API.

## Prerequisites

Install these first:

- Docker
- Foundry: `forge`, `cast`, and `anvil`
- Node.js 18 or newer
- PostgreSQL client tools: `psql` and `pg_isready`
- `jq`

## First-Time Setup

From the repo root:

```bash
make install
```

This installs dependencies for the contracts, solver, indexer, API, MCP server, demo script, and web docs.

## Run the Full Local Demo

The fastest path is:

```bash
make e2e
```

This starts Docker infrastructure, deploys contracts, starts services, and runs the demo script.

If you want each step separately, use:

```bash
make up
make deploy
make services
make demo
```

Expected outputs from `make demo` include:

- Agent ID
- Solver ID
- Attestor ID
- Policy account address
- Session-key execution transaction hash
- Agent address
- Intent ID
- Intent status
- Register transaction hash
- Submit transaction hash
- API responses for agents, policies, intents, transaction explanation, and health
- Policy preflight response for the allowlisted intent target
- Reserved intent metadata linked to the indexed intent

## Service URLs and Ports

| Service | Default |
| --- | --- |
| Anvil RPC | `http://127.0.0.1:8545` |
| Postgres | `localhost:5433` |
| REST API | `http://localhost:3001` |

The API port can be changed when starting services:

```bash
API_PORT=3010 make services
API_PORT=3010 make demo
```

The Postgres host port can be changed when starting Docker Compose:

```bash
POSTGRES_PORT=55433 DATABASE_URL=postgresql://ai_chain:ai_chain@localhost:55433/ai_chain make up
DATABASE_URL=postgresql://ai_chain:ai_chain@localhost:55433/ai_chain make deploy
DATABASE_URL=postgresql://ai_chain:ai_chain@localhost:55433/ai_chain API_PORT=3010 make services
API_PORT=3010 make demo
```

## Important Generated Files

Deployment writes local addresses and demo keys to:

```bash
ops/.env.deployed
```

Service logs are written to:

```bash
ops/indexer.log
ops/solver.log
ops/api.log
```

Service process IDs are written to:

```bash
ops/indexer.pid
ops/solver.pid
ops/api.pid
```

## Manual API Checks

After `make services` and `make demo`, check the API directly:

```bash
curl http://localhost:3001/health
curl "http://localhost:3001/intents?status=filled"
curl "http://localhost:3001/agents/1"
curl -X POST http://localhost:3001/preflight \
  -H 'content-type: application/json' \
  -d '{"account":"0x...","target":"0x...","value":"0","data":"0x"}'

curl -X POST http://localhost:3001/intents/1/bids \
  -H 'content-type: application/json' \
  -d '{"solver":"0x...","amount_in":"1000","amount_out":"950","fee":"0","valid_until":"9999999999"}'

curl http://localhost:3001/intents/1/bids
curl http://localhost:3001/attestations/schemas
```

The demo uses `@ai-chain/sdk` to reserve metadata before submitting the onchain intent. A minimal agent-facing flow looks like:

```ts
const result = await agentClient.createIntent({
  intent: {
    constraints,
    inputToken,
    outputToken,
    nonce,
  },
  metadata: {
    execution_target: target,
    execution_data: calldata,
  },
  preflight: {
    account: agentAddress,
    target: intentBook,
    value: "0",
    data: "0x",
  },
});
```

To inspect policies for the demo agent, get the address from the demo output or from `ops/.env.deployed`:

```bash
source ops/.env.deployed
curl "http://localhost:3001/accounts/$AGENT_ADDRESS/policies"
```

To explain a transaction, use the submit transaction hash from the demo output:

```bash
curl "http://localhost:3001/tx/<tx-hash>/explain"
```

## Manual Database Checks

Connect to the local Postgres database:

```bash
psql "postgresql://ai_chain:ai_chain@localhost:5433/ai_chain"
```

Useful queries:

```sql
SELECT * FROM indexer_state;

SELECT agent_id, owner, revoked, block_number
FROM agents
ORDER BY agent_id DESC
LIMIT 10;

SELECT intent_id, owner, status, deadline, block_number
FROM intents
ORDER BY intent_id DESC
LIMIT 10;

SELECT intent_id, solver, amount_in, amount_out, tx_hash
FROM fills
ORDER BY id DESC
LIMIT 10;

SELECT account, policy_type, token, target, selector, value
FROM policies
ORDER BY id DESC
LIMIT 20;
```

## Run Tests

Contracts:

```bash
cd contracts
forge test
```

Service tests:

```bash
cd api && npm test
cd ../indexer && npm test
cd ../solver && npm test
```

Build checks:

```bash
cd api && npm run build
cd ../indexer && npm run build
cd ../solver && npm run build
cd ../mcp && npm run build
cd ../web && npm run build
```

## MCP Server

The MCP server exposes agent-readable tools backed by the API/database.

Build it:

```bash
cd mcp
npm run build
```

Configure your MCP client to run:

```bash
node mcp/dist/src/index.js
```

Use this environment value:

```bash
DATABASE_URL=postgresql://ai_chain:ai_chain@localhost:5433/ai_chain
```

Useful tools to test:

- `lookup_agent`
- `list_open_intents`
- `get_policy`
- `explain_tx`
- `lookup_attestation`

## Testnet Flow

For Base Sepolia testing:

1. Create and fund deployer, solver, and agent wallets.
2. Copy and fill the testnet environment file.
3. Deploy contracts.
4. Run migrations against a hosted Postgres database.
5. Start indexer, solver, and API with the testnet environment.

Commands:

```bash
cp ops/.env.testnet.example ops/.env.testnet
source ops/.env.testnet
./ops/deploy-testnet.sh
psql "$DATABASE_URL" -f indexer/migrations/001_init.sql
psql "$DATABASE_URL" -f indexer/migrations/002_attestations.sql
psql "$DATABASE_URL" -f indexer/migrations/003_participants.sql
```

Then start each service:

```bash
cd indexer && npm run build && node dist/src/index.js
cd solver && npm run build && node dist/src/index.js
cd api && npm run build && node dist/src/index.js
```

## Cleanup

Stop services and Docker infrastructure:

```bash
make down
```

Remove containers, volumes, logs, pids, and generated deployment files:

```bash
make clean
```

## Troubleshooting

If the solver does not fill an intent:

```bash
tail -100 ops/solver.log
```

Common causes:

- Solver service is not running.
- `INTENT_BOOK_ADDRESS` is missing or stale in `ops/.env.deployed`.
- Solver wallet has no gas on testnet.
- Intent is expired, cancelled, or already filled.

If API responses are empty:

```bash
tail -100 ops/indexer.log
```

Common causes:

- Indexer has not caught up yet.
- Contract addresses in the environment file do not match the deployment.
- Database migrations were not run.

If ports are already in use:

```bash
make down
make clean
```

Then retry the local flow.

## Current Limitations

The local demo proves the control flow, but it does not yet execute real DEX swaps or production-grade commerce flows.

Current limitations to keep in mind while testing:

- The solver fills intents at constraint boundaries.
- `executionData` is not yet used for real route execution.
- Policies mostly cover native ETH value and allowlisted targets/functions.
- ERC-20 approval and transfer policy enforcement needs to be expanded.
- Solver and attestor registries now exist, but staking/challenges and settlement-controlled reputation still need production hardening.
- Attestations are indexed with full `dataHash`/timestamp and can be queried by subject, but solver requirements and reputation scoring still need to be enforced in execution.
