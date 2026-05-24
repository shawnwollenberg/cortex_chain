# Architecture

Cortex is a Base-native protocol for agentic commerce. The core system is a set of onchain contracts plus offchain services that make the state easy for agents, dashboards, and marketplaces to query.

## System Diagram

```text
Agent / Smart Account
  | registers identity
  | configures spend, target, swap, facilitator, and x402 policies
  | signs intents or payment authorizations
  v
AgentRegistry + PolicyModule + PolicyAccount
  | identity, delegated budgets, target/function checks, session keys
  v
IntentBook <---------------- SolverRegistry
  | signed intents              | solver metadata, bonds, quality counters
  | selected bids               |
  | fills                       v
  +-----------------------> Solver service

Merchant / Service Operator
  | registers merchant, services, facilitators
  | commits quotes
  v
CommerceRegistry
  | merchants
  | services
  | facilitators
  | quote commitments
  | receipts
  | disputes
  | zero-fee protocol instrumentation

AttestorRegistry + AttestationRegistry
  | attestor metadata
  | schema-based provenance and safety signals

All contract events
  v
Indexer -> Postgres -> REST API / MCP / Dashboard
```

## Core Flows

### Agent Identity and Policy

1. Agent owner registers an agent in `AgentRegistry`.
2. Owner configures `PolicyModule` rules for native transfers, ERC-20 transfers/approvals, swaps, allowed targets, function selectors, session keys, and signed payment budgets.
3. `PolicyAccount` checks policy before execution and records spend.
4. Signed payment policies cover facilitator-mediated and x402-style authorizations with merchant, token, facilitator, per-payment, daily-budget, and replay checks.

### Intent Execution

1. Agent signs an EIP-712 intent for `IntentBook`.
2. Solver submits a bid and the agent selects it.
3. Solver fills the intent only if the selected bid, solver, execution commitment, amounts, deadline, and optional attestation requirements match.
4. Fill events update indexed solver quality metrics and transaction explanations.

### Commerce

1. Merchant registers a merchant record and one or more services in `CommerceRegistry`.
2. Service metadata points to a machine-readable catalog with capabilities, payment rails, input/output schemas, SLA, refund, privacy, and attestation requirements.
3. Agent checks service state and account policy before accepting terms.
4. Merchant commits a quote binding merchant, service, agent, token, facilitator/payment rail, amount, expiry, payment nonce, resource hash, terms hash, optional x402 payload hash, and protocol fee terms.
5. Payment can happen through wallet-to-wallet transfer, ERC-20 transfer, swap, facilitator-mediated settlement, or x402.
6. Receipt records settlement and result/resource hashes.
7. Disputes can be opened and resolved against receipts, creating reputation and risk signals for both agents and merchants.

## Payment Rails

Cortex is not x402-only.

- **Basic transfers:** native or ERC-20 wallet-to-wallet payments governed by spend limits and target/function policies.
- **Swaps:** DEX/router calls governed by target allowlists, selector allowlists, spend limits, and intent constraints.
- **Facilitator-mediated payments:** delegated payment flows where a facilitator settles on behalf of an authorization.
- **x402:** web-native payment acceptance, bound into quote commitments through `x402PayloadHash` when used.

## Contract Architecture

| Contract | Purpose | Key Feature |
|----------|---------|-------------|
| `AgentRegistry` | Agent identity | Owner, metadata URI, pubkey, capabilities hash |
| `PolicyModule` | Policy enforcement | Spend limits, target/function allowlists, signed payment policy, replay protection |
| `PolicyAccount` | Smart account | Policy-gated execution, session keys, guardian freeze |
| `IntentBook` | Intent lifecycle | EIP-712 intents, selected bids, solver fill enforcement |
| `SolverRegistry` | Solver discovery | Operator metadata, bond, fill quality counters |
| `AttestorRegistry` | Attestor discovery | Operator metadata and schema support |
| `AttestationRegistry` | Provenance | Schema-based attestations and revocation |
| `CommerceRegistry` | Agentic commerce | Merchants, services, facilitators, quotes, receipts, disputes |
| `DemoTarget` | Local demo | Simple executable target for e2e testing |

## Indexed Data

| Table | Indexed From | Purpose |
|-------|-------------|---------|
| `agents` | Agent registry events | Agent identity and owner lookups |
| `intents` | Intent events | Intent state, constraints, status |
| `solver_bids` | Bid events and API helper | Bid market inspection |
| `fills` | Fill events | Solver fills, result hashes, trace hashes |
| `policies` | Policy events | Account spend, allowlist, and signed payment policy state |
| `solvers` | Solver registry and fill events | Solver metadata and performance metrics |
| `attestors` | Attestor registry events | Attestor metadata and counters |
| `attestation_schemas` | API/bootstrap data | Machine-readable schema discovery |
| `merchants` | Commerce registry events | Merchant discovery and payout context |
| `services` | Commerce registry events | Service discovery and capability lookup |
| `facilitators` | Commerce registry events | Payment facilitator discovery |
| `quotes` | Quote events | Canonical quote/payment terms and fee instrumentation |
| `commerce_receipts` | Receipt events | Settled commerce records |
| `disputes` | Dispute events | Refund/dispute/reputation signals |
| `tx_receipts` | All decoded transactions | Human and machine transaction explanations |

## API, MCP, and Dashboard

- REST API exposes indexed state for agents and frontends.
- MCP tools expose selected API functionality to model-driven agents.
- Dashboard reads `/analytics/commerce`, merchant/service discovery, receipts, and disputes.
- Analytics include volume, settled volume, zero-fee protocol fee fields, dispute counts, and facilitator/merchant/service leaderboards.

## Deployment Shape

The current path is protocol-first on Base or Base Sepolia. This keeps existing stablecoins, ERC-20 liquidity, wallets, explorers, and developer tooling available from day one. If agentic commerce activity later justifies deeper execution changes, the same primitives can become predeploys or chain-native modules.

## Technology Stack

- **Contracts:** Solidity 0.8.24, Foundry, OpenZeppelin
- **Solver:** TypeScript, viem, node-postgres
- **Indexer:** TypeScript, viem, node-postgres
- **API:** TypeScript, Express 4, node-postgres
- **Dashboard/docs:** Next.js, React, Tailwind
- **Database:** PostgreSQL 16
- **Local dev:** Anvil, Docker Compose
