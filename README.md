# Cortex

An EVM-compatible Layer 2 designed for AI agents. Agents have onchain identity, transact via policy-aware smart accounts (ERC-4337), submit intents that solvers execute, and query machine-readable state through an indexing + API layer.

## Architecture

```
Agent Runtime (signs EIP-712 intents, holds private key)
    |                              |
    | submitIntent()               | registerAgent()
    v                              v
IntentBook                    AgentRegistry
(EIP-712 + constraints)       (identity + metadata)
    |                              |
    | IntentSubmitted event        |
    v                              |
Solver                             |
(watches events, simulates)        |
    |                              |
    | fillIntent()                 |
    v                              v
PolicyModule (spend limits, target allowlists, function allowlists)
    |
    v
Indexer (polls chain, ingests events -> Postgres)
    |
    v
REST API (/agents, /intents, /accounts, /tx/:hash)
```

## Repo Layout

```
contracts/   Solidity (Foundry): AgentRegistry, PolicyModule, IntentBook, AttestationRegistry
solver/      TypeScript offchain service: watches intents, simulates, executes fills
indexer/     Event ingestion into Postgres
api/         REST API for agent-readable queries
mcp/         Model Context Protocol server for AI agent integration
web/         Documentation website
ops/         Docker Compose, deploy scripts, observability
docs/        Architecture, threat model, runbooks
```

## Quick Start

```bash
make install   # install all dependencies
make e2e       # start infra, deploy contracts, launch services, run demo
```

This starts Anvil (local EVM), deploys contracts, launches the indexer/solver/API, and runs a full demo scenario.

## Step-by-Step

```bash
make up        # start Anvil + Postgres (Docker)
make deploy    # deploy contracts to local devnet
make services  # start indexer, solver, API
make demo      # run end-to-end demo
make down      # stop everything
```

## Testnet Deployment

Deploy to Base Sepolia (or OP Sepolia) with:

```bash
export DEPLOYER_KEY=0x<your-key>
./ops/deploy-testnet.sh
```

See [docs/testnet-deploy.md](docs/testnet-deploy.md) for the full guide.

## Contracts

Built with Foundry and OpenZeppelin. Solidity 0.8.24.

| Contract | Purpose |
|----------|---------|
| `AgentRegistry` | Agent identity: metadata, pubkey, capabilities |
| `IntentBook` | Intent lifecycle: submit (EIP-712), fill, cancel |
| `PolicyModule` | Policy enforcement: spend limits, target/function allowlists |
| `PolicyAccount` | ERC-4337 smart account with policy validation |
| `AttestationRegistry` | Signed provenance for offchain inputs |

```bash
cd contracts
forge build       # compile
forge test        # run tests
forge test --fuzz-runs 1000  # fuzz testing
```

## Offchain Services

All TypeScript, using viem and node-postgres.

| Service | Port | Description |
|---------|------|-------------|
| Indexer | - | Polls chain events, writes to Postgres |
| Solver | - | Watches intents, simulates, fills |
| API | 3001 | REST endpoints for agents, intents, policies, tx explain |
| MCP | stdio | Tools: `lookup_agent`, `list_open_intents`, `get_policy`, `explain_tx` |

## Tech Stack

| Layer | Stack |
|-------|-------|
| Contracts | Solidity 0.8.24, Foundry, OpenZeppelin |
| Services | TypeScript, viem, node-postgres |
| API | Express 4, node-postgres |
| Database | PostgreSQL 16 |
| Local dev | Anvil, Docker Compose |
| Target L2 | OP Stack (Base Sepolia) |

## Documentation

- [Local Development](docs/local-dev.md)
- [Testnet Deployment](docs/testnet-deploy.md)
- [Architecture](docs/architecture.md)
- [Contracts Reference](docs/contracts.md)
- [REST API Reference](docs/api.md)
- [MCP Server](docs/mcp.md)
- [Design Decisions](docs/decisions.md)
- [Security / Threat Model](docs/security.md)

## License

MIT
