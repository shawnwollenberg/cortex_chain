# Cortex

A Base-native protocol for agentic commerce. Agents have onchain identity, transact through policy-aware smart accounts, discover merchants and services, accept verifiable quote commitments, record receipts and disputes, and query machine-readable state through an indexing + API layer.

## Architecture

```
Agent / Smart Account
  | identity, delegated budgets, target/function policy, signed payment policy
  v
AgentRegistry + PolicyModule + PolicyAccount
  |
  | signed intents                         Merchant / Service Operator
  v                                        | merchant, services, facilitators, quotes
IntentBook <-> SolverRegistry              v
  | fills                                  CommerceRegistry
  |                                        | receipts, fulfillment, disputes, trust signals
  v                                        |
AttestorRegistry + AttestationRegistry <---+
  |
  v
Indexer -> Postgres -> REST API / MCP / Dashboard
```

## Repo Layout

```
contracts/   Solidity (Foundry): identity, policy, intent, attestation, solver/attestor, commerce registries
solver/      TypeScript offchain service: watches intents, simulates, executes fills
indexer/     Event ingestion into Postgres
api/         REST API for agent-readable queries
sdk/         TypeScript SDK for agent intent creation, preflight, and metadata reservation
mcp/         Model Context Protocol server for AI agent integration
web/         Marketing site, documentation, and dashboard
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

## Testnet Deployment (Base Sepolia)

Live services:

- Frontend: <https://cortex.wallyweb.com>
- API: <https://api.cortex.wallyweb.com>
- API health: <https://api.cortex.wallyweb.com/health>

Live on Base Sepolia (chain ID 84532):

| Contract | Address |
|----------|---------|
| AgentRegistry | [`0x9e2b846226539e93669e66c7478304910dcbaa61`](https://sepolia.basescan.org/address/0x9e2b846226539e93669e66c7478304910dcbaa61) |
| IntentBook | [`0xea1db573f299a3f064ffd306b309179ff0542e8c`](https://sepolia.basescan.org/address/0xea1db573f299a3f064ffd306b309179ff0542e8c) |
| PolicyModule | [`0x8f14e12177c7baf8d389629210c3c82718205fd1`](https://sepolia.basescan.org/address/0x8f14e12177c7baf8d389629210c3c82718205fd1) |
| AttestationRegistry | [`0xefe648ecf2615e09ddf89ec5f1cf36dbb462e84a`](https://sepolia.basescan.org/address/0xefe648ecf2615e09ddf89ec5f1cf36dbb462e84a) |
| SolverRegistry | [`0xbc62d0aff03e5e87553eec0b9eeb59da27f0dea2`](https://sepolia.basescan.org/address/0xbc62d0aff03e5e87553eec0b9eeb59da27f0dea2) |
| AttestorRegistry | [`0xbe00be1f56e3315cdbec8fa72d7962d931dc83f1`](https://sepolia.basescan.org/address/0xbe00be1f56e3315cdbec8fa72d7962d931dc83f1) |
| CommerceRegistry | [`0x378c1d1a06e80f7a53809bf4289afcd131a3be87`](https://sepolia.basescan.org/address/0x378c1d1a06e80f7a53809bf4289afcd131a3be87) |

Deploy your own with:

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
| `SolverRegistry` | Permissionless solver metadata, bond, and reputation counters |
| `AttestorRegistry` | Permissionless attestor metadata and schema support |
| `CommerceRegistry` | Merchants, services, facilitators, quotes, receipts, fulfillment, trust signals, and disputes |

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
| API | 3001 locally / `https://api.cortex.wallyweb.com` live | REST endpoints for agents, intents, policies, commerce, analytics, tx explain |
| MCP | stdio | Tools: `lookup_agent`, `list_open_intents`, `get_policy`, `explain_tx`, `list_solvers`, `list_attestors` |
| SDK | - | Agent client for signed intent creation, policy preflight, and execution metadata reservation |

## Tech Stack

| Layer | Stack |
|-------|-------|
| Contracts | Solidity 0.8.24, Foundry, OpenZeppelin |
| Services | TypeScript, viem, node-postgres |
| API | Express 4, node-postgres |
| Database | PostgreSQL 16 |
| Local dev | Anvil, Docker Compose |
| Current network | Base Sepolia protocol deployment |
| Hosted stack | AWS ECS Fargate, RDS Postgres, S3, CloudFront, Route53 |

## Documentation

- [Local Development](docs/local-dev.md)
- [Usage and Testing](docs/usage-testing.md)
- [Testnet Deployment](docs/testnet-deploy.md)
- [Architecture](docs/architecture.md)
- [Contracts Reference](docs/contracts.md)
- [REST API Reference](docs/api.md)
- [Agentic Commerce](docs/agentic-commerce.md)
- [MCP Server](docs/mcp.md)
- [Design Decisions](docs/decisions.md)
- [Protocol Roadmap](docs/protocol-roadmap.md)
- [Security / Threat Model](docs/threat-model.md)

## License

MIT
