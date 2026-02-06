# Agent-Native Ethereum L2 (EVM) — Build Instructions for a Coding LLM

You are an expert rollup + smart contract + distributed systems engineer. Produce production-quality code, docs, and tests. Optimize for correctness, security, and incremental delivery. When unsure, choose the simplest secure approach and document tradeoffs.

## Goal (What we are building)
Build an **EVM-compatible Layer 2** that is **AI-agent friendly**:
- Agents have **identity** and **capabilities**
- Agents transact via **policy-aware smart accounts** (guardrails)
- Agents submit **intents** (outcome requests), and a solver executes them
- The chain provides **machine-readable state** via an indexing + API layer (and optional MCP tools)
- Inputs can be **attested** (signed provenance) to reduce “garbage-in” risk

Deliver an MVP that can run on a local devnet and public testnet.

---

## Success Criteria (MVP)
A demo script should show:
1) Spin up the L2 locally (or a devnet) and deploy contracts
2) Register an Agent Identity
3) Create a 4337 Smart Account with policy rules (spend limits + allowlist)
4) Submit an Intent: e.g., “Swap up to X USDC for ETH with max slippage Y”
5) A solver picks up the intent, simulates, and executes it
6) Indexer exposes machine-readable state via API:
   - `GET /agents/:id`
   - `GET /accounts/:address/policies`
   - `GET /intents?status=open|filled`
   - `GET /tx/:hash/receipt/explain`
7) All of the above are tested and documented.

---

## Build Strategy (Do NOT build a rollup from scratch)
Use a proven rollup framework:
- **Preferred:** OP Stack (optimism monorepo tooling) for fastest bring-up
- Alternative: Arbitrum Orbit
- zk stacks are allowed only if you already have deep zk expertise

The MVP can start **on an existing L2** (Base/OP Sepolia) to validate product quickly, then migrate to a dedicated L2. If time constrained, do that.

---

## Repo Layout
Create a mono-repo with these top-level directories:

- `contracts/`
  - Solidity contracts (identity, policies, intents)
  - Foundry test suite + fuzzing
- `solver/`
  - Offchain service that watches for intents and executes them
  - Simulation + route selection (start simple)
- `indexer/`
  - Event ingestion + materialized views
  - Postgres + OpenSearch optional; start with Postgres for MVP
- `api/`
  - REST API (or GraphQL) for agent-readable queries
  - Optional: MCP server exposing tools for AI agents
- `ops/`
  - Docker compose for local dev
  - Deployment scripts for testnet
  - Observability stack (Prometheus/Grafana) minimal
- `docs/`
  - Architecture, threat model, runbooks, demo scripts

---

## Core Components & Specs

### 1) Agent Identity (Onchain)
**Purpose:** identity is not “wallet == user”, but “wallet == process”.
Implement:
- `AgentRegistry.sol`
  - `registerAgent(metadataURI, pubkey, capabilitiesHash) -> agentId`
  - `updateAgent(agentId, metadataURI, capabilitiesHash)`
  - `revokeAgent(agentId)`
  - Emit events for indexer

Design notes:
- Use ERC-721 or ERC-1155 **only if needed**. Otherwise store agent records directly.
- Include optional `stake` field (can be future work). MVP can omit staking.

Acceptance tests:
- Register, update, revoke
- Query by owner address
- Events indexed properly

---

### 2) Policy-Aware Smart Accounts (ERC-4337)
**Purpose:** enforce guardrails so AI can’t go rogue.
Implement:
- Use a reference 4337 account (e.g., SimpleAccount-style) with modular validation.
- `PolicyModule.sol` (or `PolicyValidator.sol`)
  - Spend limits: daily cap per token
  - Allowlist of contract targets
  - Require simulation proof / pre-approval flag (MVP can be a boolean gate)

Minimal policy checks:
- `maxValuePerDay[token]`
- `allowedTargets[target]`
- `allowedFunctions[target][selector]` (optional)
- `blockTimestamp`-based rolling window is acceptable for MVP; document limitations.

Acceptance tests:
- Allowed tx passes
- Disallowed target fails
- Exceeds daily cap fails
- Policy updates controlled by account owner (and optional guardian)

Security:
- Prevent bypass via `delegatecall` to untrusted targets
- Consider callvalue vs token transfer nuances
- Document known limitations

---

### 3) Intent System (Outcome-Based)
**Purpose:** Agents submit desired outcome; solver executes best path.

Implement:
- `IntentBook.sol`
  - `submitIntent(Intent calldata) -> intentId`
  - `cancelIntent(intentId)`
  - `fillIntent(intentId, Fill calldata)`: callable by solvers
  - Status: `OPEN, FILLED, CANCELLED, EXPIRED`
- Intent struct should include:
  - `owner` (agent smart account)
  - `intentType` (enum)
  - `constraints` (amountInMax, amountOutMin, deadline, slippageBps)
  - `inputToken`, `outputToken`
  - `nonce` / replay protection
  - `signature` (EIP-712 typed data)

Start with 1 intent type:
- `SWAP_EXACT_IN_MAX_SLIPPAGE` using a known DEX on your target network (Uniswap v3/v2 compatible)

Acceptance tests:
- Valid signed intent accepted
- Replay rejected
- Cancel works
- Fill validates constraints strictly
- Emits `IntentSubmitted`, `IntentFilled` with details

---

### 4) Solver Service (Offchain)
**Purpose:** monitors intents, simulates, executes fills.

Implement solver as a stateless service:
- Watches `IntentSubmitted` events
- Validates:
  - signature
  - constraints
  - policy constraints on the account (offchain pre-check)
- Simulates execution (callStatic / eth_call)
- Executes fill transaction:
  - calls `IntentBook.fillIntent(...)`
  - performs swap in same tx (or via internal router call)

MVP simplification:
- Run a single solver instance you control
- Hardcode route selection to a single DEX first
- Add MEV protection later (private tx, bundles, etc.)

Acceptance tests:
- Integration test: submit intent -> solver fills -> status becomes FILLED
- Handles expired intents
- Handles simulation failures gracefully

---

### 5) Indexer + Agent-Readable API
**Purpose:** make the chain “queryable like a database” for agents.

Indexer:
- Ingest events from:
  - AgentRegistry
  - Policy module (policy updated events)
  - IntentBook
  - ERC-4337 ops / account events (optional)
- Store into Postgres:
  - `agents`, `policies`, `intents`, `fills`, `tx_receipts`

API:
- REST endpoints:
  - `GET /agents/:agentId`
  - `GET /agents?owner=0x...`
  - `GET /accounts/:address/policies`
  - `GET /intents?status=open|filled|cancelled`
  - `GET /intents/:id`
  - `GET /tx/:hash/explain` (human+agent readable receipt summary)

Optional MCP server:
- Provide tools:
  - `lookup_agent(agentId)`
  - `list_open_intents()`
  - `get_policy(account)`
  - `explain_tx(hash)`

Acceptance tests:
- API returns correct data within N seconds of onchain event
- Basic pagination + filters

---

### 6) Verifiable Inputs (MVP Attestations)
**Purpose:** reduce risk from untrusted offchain inputs.

Implement:
- `AttestationRegistry.sol`
  - `submitAttestation(subject, schema, dataHash, signer)`
  - verify signatures for known attestors
- Indexer stores attestations and links them to intents/agents when referenced

MVP use:
- Solver can require a signed price quote attestation or “simulation success attestation” before filling large trades.

Acceptance tests:
- Valid attestation accepted
- Unknown signer rejected (if allowlist enabled)

---

## Rollup / Chain Bring-up (OP Stack recommended)
Create scripts to:
- Launch local OP Stack devnet
- Deploy core contracts to the L2
- Configure RPC endpoints

Deliverables:
- `ops/docker-compose.yml` for local chain + services
- `ops/deploy.sh` to deploy contracts
- `docs/local-dev.md` with one command to run end-to-end

---

## Testing Requirements
Contracts (Foundry):
- Unit tests + fuzz tests for all constraints and signature verification
- Invariants:
  - intents cannot be filled twice
  - policy caps cannot be bypassed
  - signature replay protection holds

Services:
- Integration test in CI that runs:
  - chain
  - deploy
  - indexer
  - solver
  - demo scenario

Add a `make demo` that prints:
- agentId
- intentId
- fill tx hash
- API query results

---

## Security Requirements (MVP-level)
Produce a `docs/threat-model.md` covering:
- Bridge / rollup risks (high level, documented)
- Intent manipulation / replay
- Solver censorship or abuse
- Policy bypass patterns (delegatecall, approve/transferFrom tricks)
- Key management assumptions

Add:
- `slither` + `solhint` + `forge fmt` in CI
- Basic static analysis and lint gates

---

## Documentation Requirements
Write concise docs:
- `docs/architecture.md` (diagram + data flow)
- `docs/contracts.md` (interfaces + events)
- `docs/api.md` (endpoints)
- `docs/demo.md` (step-by-step)
- `docs/runbooks.md` (how to restart services, rotate keys, etc.)

---

## Implementation Order (Do in this order)
1) Contracts: AgentRegistry + IntentBook (with EIP-712 signing)
2) Contracts: Policy-aware 4337 account module (spend limit + allowlist)
3) Solver: watch intents, simulate, fill
4) Indexer: ingest events into Postgres
5) API: expose agent-readable endpoints
6) Local devnet + demo script
7) Hardening: fuzz tests, lint, threat model, CI integration test
8) Optional: MCP server + attestation registry

---

## Output Expectations
When you respond:
- Create the repo structure and all core code files
- Provide runnable Docker + scripts
- Provide Foundry tests and a demo script
- Keep code clean, commented, and secure-by-default
- Document assumptions and tradeoffs

If any part is ambiguous, pick a reasonable default and write it down in `docs/decisions.md`.
