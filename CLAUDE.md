# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent-Native Ethereum L2 (EVM) — an EVM-compatible Layer 2 designed for AI agents. Agents have onchain identity, transact via policy-aware smart accounts (ERC-4337), submit intents that solvers execute, and query machine-readable state through an indexing + API layer.

The full specification lives in `instructions.md`. Refer to it for detailed acceptance criteria and design notes.

## Repo Layout

```
contracts/   - Solidity (Foundry): AgentRegistry, PolicyModule, IntentBook, AttestationRegistry
solver/      - TypeScript offchain service: watches intents, simulates, executes fills
indexer/     - Event ingestion into Postgres (agents, policies, intents, fills, tx_receipts)
api/         - REST API for agent-readable queries; optional MCP server
ops/         - Docker Compose (local dev), deployment scripts, observability
docs/        - Architecture, threat model, runbooks, demo scripts
```

## Build & Test Commands

### Contracts (Foundry)
```bash
cd contracts
forge build                    # compile
forge test                     # run all tests
forge test --match-test testX  # run a single test
forge test --fuzz-runs 1000    # fuzz testing
forge fmt                      # format Solidity
slither .                      # static analysis
solhint 'src/**/*.sol'         # lint
```

### Services (Solver, Indexer, API)
```bash
# Local dev stack (chain + all services)
docker compose -f ops/docker-compose.yml up

# Deploy contracts to local devnet
./ops/deploy.sh

# Run end-to-end demo
make demo
```

### CI Gates
- Foundry unit tests + fuzz tests + invariant tests
- `slither` + `solhint` + `forge fmt` checks
- Integration test: chain → deploy → indexer → solver → demo scenario

## Architecture

### Onchain (Solidity)
- **AgentRegistry.sol** — registers agent identity (metadataURI, pubkey, capabilitiesHash). Identity is "wallet == process", not "wallet == user".
- **PolicyModule.sol** — ERC-4337 account validation module enforcing spend limits (`maxValuePerDay[token]`), target allowlists, and optional function selector allowlists. Uses `blockTimestamp`-based rolling window.
- **IntentBook.sol** — agents submit signed intents (EIP-712 typed data) with constraints; solvers fill them. Status: OPEN → FILLED/CANCELLED/EXPIRED. Replay protection via nonce.
- **AttestationRegistry.sol** — optional signed provenance for offchain inputs (price quotes, simulation results).

### Offchain
- **Solver** — stateless service watching `IntentSubmitted` events; validates signatures + constraints, simulates via `eth_call`, calls `IntentBook.fillIntent()`. MVP: single instance, hardcoded DEX routing.
- **Indexer** — ingests events from all contracts into Postgres tables.
- **API** — REST endpoints: `/agents/:agentId`, `/agents?owner=`, `/accounts/:address/policies`, `/intents?status=`, `/intents/:id`, `/tx/:hash/explain`.
- **MCP Server (optional)** — tools: `lookup_agent()`, `list_open_intents()`, `get_policy()`, `explain_tx()`.

### Data Flow
```
Agent → signs Intent (EIP-712) → IntentBook.submitIntent()
Solver → watches IntentSubmitted → validates → simulates → IntentBook.fillIntent()
Indexer → ingests all contract events → Postgres
API → queries Postgres → serves REST endpoints to agents
```

## Implementation Order

Follow this sequence (per specification):
1. Contracts: AgentRegistry + IntentBook (with EIP-712)
2. Contracts: Policy-aware ERC-4337 account module
3. Solver service
4. Indexer (events → Postgres)
5. REST API
6. Local devnet + demo script
7. Hardening: fuzz tests, lint, threat model, CI
8. Optional: MCP server + attestation registry

## Key Design Decisions

- **Rollup framework:** OP Stack preferred. MVP can deploy on existing L2 (Base/OP Sepolia) first.
- **Agent identity:** Stored as contract records, not NFTs (unless needed).
- **Policy enforcement:** Prevent bypass via `delegatecall` to untrusted targets. Consider `callvalue` vs token transfer nuances.
- **Intent signing:** EIP-712 typed data for replay protection.
- **Solver:** Single trusted instance for MVP. MEV protection deferred.
- **Indexer:** Postgres only for MVP. OpenSearch optional.
- When unsure, choose the simplest secure approach and document tradeoffs in `docs/decisions.md`.
