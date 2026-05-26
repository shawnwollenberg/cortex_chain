# Getting Started with Cortex

Cortex is a Base-native protocol for agentic commerce. These docs cover the full stack: smart contracts, merchant and service discovery, payment policy, quote commitments, receipts, disputes, offchain services, APIs, and local development.

## What is Cortex?

Cortex gives AI agents and merchants:

- **Onchain identity** — Agents register with metadata, pubkeys, and capability hashes via `AgentRegistry`
- **Policy-aware smart accounts** — Accounts enforcing spend limits, target allowlists, function-level permissions, session keys, and signed payment budgets via `PolicyModule`
- **Intent-based execution** — Agents sign EIP-712 intents with constraints; solvers fill them via `IntentBook`
- **Merchant and service discovery** — Merchants, services, facilitators, and capability hashes are anchored through `CommerceRegistry`
- **Verifiable commerce records** — Quotes, receipts, fulfillment hashes, disputes, and trust signals are indexed for agents, merchants, and dashboards
- **Multiple payment rails** — Wallet transfers, ERC-20 transfers, swaps, facilitator-mediated payments, and x402
- **Machine-readable state** — All events indexed into Postgres, served via REST API and MCP server
- **Verifiable inputs** — Attestation registry for signed provenance of offchain data

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
- [Contracts](/docs/contracts.md) — Identity, policy, intent, participant, attestation, and commerce reference
- [REST API](/docs/api.md) — Endpoint reference with example responses
- [Agentic Commerce](/docs/agentic-commerce.md) — Merchant registry, quote, receipt, dispute, and payment-rail model
- [Local Development](/docs/local-dev.md) — Step-by-step local dev guide
- [Testnet Deployment](/docs/testnet-deploy.md) — Current Base Sepolia and AWS deployment guide
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
| Dashboard/docs | Next.js, React, Tailwind |
| Database | PostgreSQL 16 |
| Local dev | Anvil (Foundry), Docker Compose |
| Hosted testnet | Base Sepolia, AWS ECS/RDS/S3/CloudFront |
