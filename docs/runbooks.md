# Runbooks

Operational procedures for the Agent-Native L2 stack.

## Restart Services

### Restart All Services

```bash
make down
make services
```

### Restart Individual Service

```bash
# Stop one service
kill $(cat ops/<service>.pid)

# Restart it (from repo root)
cd <service> && node dist/src/index.js >> ../ops/<service>.log 2>&1 &
echo $! > ../ops/<service>.pid
```

Replace `<service>` with `indexer`, `solver`, or `api`.

### Restart After Crash

Check logs first:
```bash
tail -100 ops/indexer.log
tail -100 ops/solver.log
tail -100 ops/api.log
```

If the indexer crashed, it will resume from its last checkpoint (`_meta.last_processed_block` in Postgres). No data loss.

If the solver crashed, open intents remain OPEN on-chain. The solver will pick them up when restarted.

## Redeploy Contracts

Only needed if contract code changes. State is lost on redeploy.

```bash
make clean
make up
make deploy
make services
```

## Database Operations

### Connect to Postgres

```bash
psql "postgresql://ai_chain:ai_chain@localhost:5433/ai_chain"
```

### Check Indexer Progress

```sql
SELECT * FROM _meta;
```

### View Recent Intents

```sql
SELECT intent_id, owner, status, created_at
FROM intents
ORDER BY intent_id DESC
LIMIT 10;
```

### View Agent Policies

```sql
SELECT * FROM policies
WHERE account = '0x...'
ORDER BY policy_type;
```

### Reset Indexer State

If the indexer gets out of sync:

```sql
TRUNCATE agents, intents, fills, policies, tx_receipts, _meta;
```

Then restart the indexer — it will re-index from block 0.

## Rotate Keys

### Solver Key

1. Stop the solver: `kill $(cat ops/solver.pid)`
2. Update `SOLVER_PRIVATE_KEY` in `ops/.env.deployed`
3. Fund the new solver address on the L2
4. Restart: `make services`

### Agent Key

Agent keys are managed by the agent runtime. To rotate:

1. Register a new agent with the new key via `AgentRegistry.registerAgent()`
2. Revoke the old agent via `AgentRegistry.revokeAgent(agentId)`
3. Reconfigure policies on the new account via `PolicyModule`

### Deployer Key

The deployer key has no special privileges after deployment. Rotation is not needed unless redeploying.

## Monitor Health

### API Health Check

```bash
curl http://localhost:3001/health
```

### Check Service Processes

```bash
ps -p $(cat ops/indexer.pid) -o pid,command
ps -p $(cat ops/solver.pid) -o pid,command
ps -p $(cat ops/api.pid) -o pid,command
```

### Check Anvil

```bash
cast block-number --rpc-url http://localhost:8545
```

### Check Postgres

```bash
pg_isready -h localhost -p 5433
```

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| API returns 500 | Database connection issue | Check Postgres is running, verify DATABASE_URL |
| Indexer stuck at block N | RPC node issue | Check Anvil logs, restart Anvil if needed |
| Solver not filling | Intent already filled/cancelled | Check `ops/solver.log`, verify intent status |
| Empty API results | Indexer hasn't caught up | Wait a few seconds, check `ops/indexer.log` |
| Port already in use | Previous process not cleaned up | `make clean` or manually kill the process |
