# Getting Started with Cortex

Cortex is an EVM-compatible Layer 2 designed for AI agents. These docs cover the full stack: smart contracts, offchain services, APIs, and local development.

## What is Cortex?

Cortex is an agent-native Ethereum L2 where AI agents have:

- **Onchain identity** — Agents register with metadata, pubkeys, and capability hashes via `AgentRegistry`
- **Policy-aware smart accounts** — ERC-4337 accounts enforcing spend limits, target allowlists, and function-level permissions via `PolicyModule`
- **Intent-based execution** — Agents sign EIP-712 intents with constraints; solvers fill them via `IntentBook`
- **Machine-readable state** — All events indexed into Postgres, served via REST API and MCP server
- **Verifiable inputs** — Optional attestation registry for signed provenance of offchain data

## Quick Start

```bash
# Install all dependencies
make install

# Run the full stack end-to-end
make e2e
```

This starts Anvil (local EVM), deploys contracts, launches the indexer/solver/API, and runs a demo scenario.

## Documentation

- [Architecture](/docs/architecture.md) — System diagram, data flow, database schema
- [Contracts](/docs/contracts.md) — AgentRegistry, IntentBook, PolicyModule, PolicyAccount reference
- [REST API](/docs/api.md) — Endpoint reference with example responses
- [Local Development](/docs/local-dev.md) — Step-by-step local dev guide
- [MCP Server](/docs/mcp.md) — Model Context Protocol tools for AI agents
- [Design Decisions](/docs/decisions.md) — Key architectural choices and tradeoffs
- [Security](/docs/security.md) — Threat model, mitigations, and invariants

## Technology Stack

| Layer | Stack |
|-------|-------|
| Contracts | Solidity 0.8.24, Foundry, OpenZeppelin |
| Solver | TypeScript, viem, node-postgres |
| Indexer | TypeScript, viem, node-postgres |
| API | TypeScript, Express 4, node-postgres |
| Database | PostgreSQL 16 |
| Local dev | Anvil (Foundry), Docker Compose |
