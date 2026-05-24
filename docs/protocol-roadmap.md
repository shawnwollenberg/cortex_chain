# Cortex Protocol Roadmap

This roadmap keeps Cortex protocol-first: prove the agent-native workflow on Base or another mature OP Stack chain, then graduate to a dedicated L3/L2 only after the primitives are stable and worth making chain-native.

## Positioning

Cortex should start as an agent execution protocol, not a custom chain.

The current system already has the right first layer:

- Onchain agent identity through `AgentRegistry`
- Guarded execution through `PolicyAccount` and `PolicyModule`
- Outcome-based requests through `IntentBook`
- Solver execution
- Indexed state through Postgres, REST, and MCP
- Basic provenance through `AttestationRegistry`

That is enough to test whether agents want a safer transaction layer. It is not yet enough to justify operating a dedicated chain.

## Why Protocol First

Contracts on Base are the better first move because they let us validate agent behavior without carrying rollup operations, bridge risk, node operations, or sequencer design too early.

A dedicated chain becomes worth it when Cortex needs capabilities that contracts cannot provide cleanly:

- Native account abstraction defaults for all agent accounts
- Agent-aware fee markets, sponsored execution, or recurring gas budgets
- Sequencer-level intent batching, private ordering, and solver auctions
- Native predeploys for identity, policy checks, attestations, and reputation
- Chain-level indexing or machine-readable state guarantees
- Custom blockspace rules optimized for autonomous agents instead of human wallet flows

Until those needs are proven, the moat should be protocol quality, agent UX, policy safety, solver reliability, and machine-readable state.

## Current Gaps

The current contracts are a good MVP foundation, but a production agent protocol needs more:

- Agent delegation: session-key execution now exists; richer parent/child delegation and role semantics still need design.
- Session keys: short-lived keys with expiry and replay protection are implemented; next step is named scopes/templates.
- Rich policies: ERC-20 transfer/approval spend tracking and emergency freeze exist; recurring budgets, rate limits, and policy templates still need design.
- Permissionless solvers: registration exists; next hardening is settlement-controlled reputation, stronger staking/bond rules, allow/deny lists for early risk control, and dispute hooks.
- Attestor network: attestor registration exists; next hardening is schema registry, signed claims, revocation semantics, confidence levels, and provenance links to intents.
- Agent reputation: task success, failed fills, attestation history, solver quality, and policy violations.
- Real execution: DEX routing, payment rails, API/compute purchase flows, escrow, refunds, and failed-task settlement.
- Recovery: owner/guardian controls, key rotation, account freezing, and revocation paths.
- Observability: metrics for intent latency, solver fill quality, API freshness, policy denials, and failed simulations.

## Build Phases

### Phase 1: Harden the Current MVP

Goal: make the existing local/testnet stack reliable enough for repeated demos and developer feedback.

- Keep deployment on Base Sepolia or local Anvil.
- Make the demo path deterministic: register agent, configure policies, submit intent, fill intent, query API/MCP.
- Fix documentation drift around ports, database tables, and deployed contract set.
- Add a canonical test guide for contracts, services, demo, API, and MCP.
- Add service health checks and clearer logs for solver/indexer failures.

### Phase 2: Make Agents Safer

Goal: give agents production-grade guardrails before increasing autonomy.

- Add session-key or delegated-key support for limited agent actions.
- Extend `PolicyModule` beyond native ETH to cover ERC-20 approvals and transfers.
- Add emergency freeze and guardian-controlled recovery for agent accounts.
- Add policy templates for common workflows: DeFi operator, commerce buyer, API/compute buyer, and identity-only agent.
- Add API/MCP endpoints that explain policy state and remaining budgets in agent-readable form.

### Phase 3: Permissionless Solver and Attestor Layer

Goal: reduce centralization without jumping directly to chain infrastructure.

- Add solver registration with metadata, supported intent types, endpoint hints, and reputation counters. Initial registry is implemented; reputation counters should be settlement-driven.
- Add staking or bond fields once there is a concrete dispute path. Initial solver bond field is implemented.
- Add attestor registration and schema management. Initial attestor registry is implemented.
- Link attestations to intents, fills, simulations, price quotes, and task results.
- Add challenge windows or dispute records for bad fills, false attestations, and failed task claims.

### Phase 4: Real Agent Workflows

Goal: support multiple important workflows instead of choosing a single vertical.

- DeFi operators: swaps, rebalancing, budgeted approvals, routing, slippage controls, and solver quality.
- Agent commerce: purchases, subscriptions, escrow, refunds, API/compute payments, and receipt attestations.
- Agent identity: capabilities, delegation chains, reputation, task history, and trust discovery.

These should share the same primitives: identity, policy, intent, solver, attestation, reputation, and indexed state.

### Phase 5: Dedicated L3/L2 Decision

Goal: graduate to a chain only if the protocol has evidence that chain-level control matters.

Choose a dedicated OP Stack L3 under Base if:

- Agent transactions need custom gas sponsorship or recurring gas budgets.
- Intent settlement benefits from sequencer-level batching or solver auctions.
- Agent identity/policy/attestation predeploys materially reduce cost or complexity.
- The protocol has enough usage that operating infrastructure improves reliability or economics.

Stay contract-first if:

- Most value comes from contracts, API, MCP, and solver network behavior.
- Existing L2 fees and ordering are acceptable.
- The team still needs to iterate quickly on protocol semantics.

## Near-Term Recommendation

Move forward with the contract-first Cortex protocol on Base, while designing every major primitive so it can later become a predeploy or chain-native module.

That means the next implementation work should focus on:

- Safer agent accounts and policy coverage
- Permissionless solver/attestor foundations
- Better attestations and reputation
- Real execution workflows across DeFi, commerce, and identity
- A clean developer testing path

The dedicated chain should be treated as the scaling and differentiation layer after the agent protocol has real usage signals.
