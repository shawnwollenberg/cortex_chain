# Architecture

Cortex is a vertically integrated stack of onchain contracts and offchain services.

## System Diagram

```
Agent Runtime (signs EIP-712 intents, holds private key)
    │                              │
    │ submitIntent()               │ registerAgent()
    ▼                              ▼
IntentBook                    AgentRegistry
(EIP-712 + constraints)       (identity + metadata)
    │                              │
    │ IntentSubmitted event        │
    ▼                              │
Solver                             │
(watches events, simulates)        │
    │                              │
    │ fillIntent()                 │
    ▼                              ▼
PolicyModule (spend limits, target allowlists, function allowlists)
    │
    ▼
Indexer (polls chain, ingests events → Postgres)
    │
    ▼
Postgres (agents, intents, fills, policies, tx_receipts)
    │
    ▼
REST API (/agents, /intents, /accounts, /tx/:hash)
```

## Data Flow

1. **Agent registers** → calls `AgentRegistry.registerAgent()` → emits `AgentRegistered`
2. **Agent configures policies** → calls `PolicyModule.setSpendLimit()`, `setTargetAllowed()` → emits policy events
3. **Agent signs intent** → EIP-712 typed data (domain: "AgentIntentBook", version "1", chainId, verifyingContract)
4. **Agent submits intent** → calls `IntentBook.submitIntent(intent, v, r, s)` → validates signature + constraints → emits `IntentSubmitted`
5. **Solver watches** → polls for `IntentSubmitted` events → validates constraints → simulates via `eth_call` → calls `IntentBook.fillIntent()` → emits `IntentFilled`
6. **Indexer ingests** → polls all contract events → writes to Postgres tables (agents, intents, fills, policies, tx_receipts)
7. **API serves** → queries Postgres → returns JSON to agents or frontends

## Contract Architecture

| Contract | Purpose | Key Feature |
|----------|---------|-------------|
| `AgentRegistry` | Agent identity | Stores owner, metadataURI, pubkey, capabilitiesHash |
| `IntentBook` | Intent lifecycle | EIP-712 signing, nonce replay protection, constraint enforcement |
| `PolicyModule` | Policy enforcement | Daily spend limits, target allowlist, function selector allowlist |
| `PolicyAccount` | ERC-4337 account | Delegates validation to PolicyModule, signature verification |

## Database Schema

| Table | Indexed From | Key Columns |
|-------|-------------|-------------|
| `agents` | `AgentRegistered`, `AgentUpdated`, `AgentRevoked` | agent_id, owner, metadata_uri, revoked |
| `intents` | `IntentSubmitted`, `IntentCancelled` | intent_id, owner, status, input_token, output_token |
| `fills` | `IntentFilled` | intent_id, solver, amount_in, amount_out |
| `policies` | `SpendLimitSet`, `TargetAllowlistUpdated`, `FunctionAllowlistUpdated` | account, policy_type, token/target |
| `tx_receipts` | All transactions | tx_hash, block_number, events (JSONB) |

## Technology Stack

- **Contracts:** Solidity 0.8.24, Foundry, OpenZeppelin
- **Solver:** TypeScript, viem, node-postgres
- **Indexer:** TypeScript, viem, node-postgres
- **API:** TypeScript, Express 4, node-postgres
- **Database:** PostgreSQL 16
- **Local dev:** Anvil (Foundry), Docker Compose
