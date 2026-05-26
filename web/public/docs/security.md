# Threat Model

Security analysis for Cortex as a Base-native agentic commerce protocol. This document covers MVP-level risks, mitigations, and assumptions.

## 1. Base / L2 Dependency Risks

**Risk:** Cortex currently runs as contracts and services on Base/Base Sepolia, so it inherits network, sequencer, RPC, bridge, and stablecoin assumptions from the underlying L2 rather than operating its own chain.

| Threat | Severity | Mitigation |
|--------|----------|------------|
| Bridge exploit (token drain) | Critical | Prefer native Base assets and canonical bridges. Monitor bridge and stablecoin issuer risk. |
| Sequencer censorship | High | Base inherits OP Stack forced inclusion paths. Agents and merchants should retry or use alternate rails when liveness is degraded. |
| Sequencer liveness failure | High | Document operational fallback and pause guidance for services that depend on timely settlement. |
| Data availability gap | Medium | L1 calldata/blobs ensure state reconstructability. |
| Public RPC range limits | Medium | Indexer chunks log polling below Base Sepolia RPC range limits and checkpoints progress. |

**Assumptions:**
- We deploy protocol contracts on Base or Base Sepolia.
- We are not running a custom rollup yet; bridge and sequencer risks are inherited from the host network.

## 2. Intent Manipulation / Replay

**Risk:** Malicious actors could forge, replay, or front-run intents.

| Threat | Severity | Mitigation |
|--------|----------|------------|
| Intent replay (same chain) | High | Per-owner nonce mapping (`_usedNonces[owner][nonce]`). Once used, permanently consumed. |
| Intent replay (cross-chain) | Medium | EIP-712 domain includes `chainId` and `verifyingContract`. Intent is chain-bound. |
| Intent forgery (wrong signer) | High | EIP-712 signature verification via ECDSA.recover. Signer must match `intent.owner`. |
| Intent front-running | Medium | Solvers see intents on-chain. MVP accepts this; future: encrypted mempools or commit-reveal. |
| Expired intent fill | Low | `fillIntent()` checks `block.timestamp >= deadline` and reverts with `IntentExpired`. |
| Constraint violation | Low | `fillIntent()` enforces `amountIn <= amountInMax` and `amountOut >= amountOutMin`. |

**Invariants verified by fuzz/invariant tests:**
- No intent can be filled twice (`invariant_noDoubleFill`)
- Nonce replay always reverts (`invariant_nonceReplayProtection`)
- `filled + cancelled <= submitted` always holds (`invariant_statusConsistency`)

## 3. Solver Censorship or Abuse

**Risk:** A solver could censor specific agents, extract MEV, or grief the system.

| Threat | Severity | Mitigation |
|--------|----------|------------|
| Solver censorship | Medium | Permissionless solver registration and indexed solver reputation reduce reliance on one solver, but offchain discovery still matters. |
| Solver MEV extraction | Medium | Constraint enforcement on-chain (amountInMax/amountOutMin). Solver cannot exceed bounds. |
| Solver griefing (fill with bad data) | Low | Fill constraints checked on-chain. Invalid fills revert. |
| Solver downtime | Medium | Intents remain OPEN until deadline. Agents can cancel and resubmit. |

**Assumptions:**
- MEV protection (encrypted mempools, batch auctions) is deferred.
- Agents should evaluate solver metadata, bids, execution commitments, and indexed fill quality before selection.

## 4. Policy Bypass Patterns

**Risk:** Agents or attackers could bypass PolicyModule restrictions.

| Threat | Severity | Mitigation |
|--------|----------|------------|
| `delegatecall` to untrusted contract | High | PolicyAccount restricts execution to `call` only. `delegatecall` is not exposed. |
| `approve` + `transferFrom` bypass | Medium | ERC-20 transfer, approve, and transferFrom calldata is detected and charged against token spend limits. Token approvals also require target/function policy. |
| Spend limit race (multi-tx in same block) | Low | `recordSpend()` uses storage-level cumulative tracking. Multiple calls in one block accumulate correctly. |
| Rolling window manipulation | Low | Window resets after 24h from `lastResetTimestamp`. Cannot be shortened by the account. |
| Target allowlist bypass via proxy | Medium | Allowlist checks the direct `target` address. Proxied targets must be explicitly allowlisted. |
| Function selector collision | Low | 4-byte selectors have collision potential but are practically safe for known interfaces. |
| Signed payment replay | High | `recordSignedPayment` enforces merchant/token/facilitator policy, per-payment and daily limits, and payment-hash replay protection. |

**Invariants verified by fuzz/invariant tests:**
- `spentToday` never exceeds peak `maxPerDay` (`invariant_spentNeverExceedsPeakMax`)
- Window reset clears spending correctly (`invariant_windowResetClearsSpend`)
- Per-token spending is isolated (`invariant_perTokenIsolation`)

## 5. Key Management

**Risk:** Compromised private keys could drain agent accounts or register malicious agents.

| Threat | Severity | Mitigation |
|--------|----------|------------|
| Agent key compromise | Critical | PolicyModule caps daily spending. Target allowlist limits where funds can go. Owner can revoke agent. |
| Solver key compromise | High | Solver key can only fill intents within constraints. Cannot move funds beyond intent bounds. |
| Deployer key compromise | High | Contracts are immutable once deployed. Deployer key not privileged after deployment. |
| Key rotation | Medium | AgentRegistry supports `updateAgent`. PolicyModule policies are per-account, reconfigurable. |

**Assumptions:**
- Agent keys are managed by the AI agent's runtime environment.
- MVP does not implement multi-sig or social recovery (deferred).
- Solver uses a dedicated hot wallet with limited funding.

## 6. Smart Contract Risks

| Threat | Severity | Mitigation |
|--------|----------|------------|
| Reentrancy | Low | No external calls before state changes. Follow checks-effects-interactions. |
| Integer overflow | Low | Solidity 0.8.24 has built-in overflow checks. |
| Storage collision | Low | No upgradeable proxies in MVP. Direct deployment. |
| Uninitialized state | Low | All mappings default to zero/false. Logic handles zero gracefully. |

## 7. Commerce Risks

| Threat | Severity | Mitigation |
|--------|----------|------------|
| Fake merchant or cloned service | High | Merchant, service, and facilitator records are anchored onchain with metadata hashes. Agents should verify service metadata and trust signals. |
| Quote replay across chains or registries | High | `CommerceRegistry.computeQuoteHash` binds chain ID, registry address, merchant, service, agent, token, facilitator, amount, rail, nonce, resource hash, terms hash, x402 payload hash, and fee terms. |
| Payment payload substitution | High | x402 payloads bind through `x402PayloadHash`; transfer, swap, and facilitator details bind through terms/resource hashes plus account policy. |
| Merchant non-fulfillment | Medium | Receipts, fulfillment hashes, disputes, and trust signals create a shared risk trail. |
| Refund abuse by agents | Medium | Dispute and trust-signal history is indexed for agents and merchants. |
| Privacy leakage in metadata | Medium | Keep sensitive prompts, URLs, payloads, and business intent out of public metadata; use hashes and redacted offchain documents. |

## 8. Offchain Service Risks

| Threat | Severity | Mitigation |
|--------|----------|------------|
| Indexer data desync | Medium | Indexer tracks `lastProcessedBlock` and resumes from checkpoint. API serves stale-but-safe data. |
| API injection (SQL) | High | All queries use parameterized statements (`$1`, `$2`). No string interpolation. |
| API denial of service | Medium | Pagination limits (max 100). No unbounded queries. |
| Database corruption | Medium | Postgres WAL + standard backup procedures. Indexer migrations are idempotent. |
| Hosted API outage | Medium | Onchain state remains canonical; agents can fall back to direct RPC/log reads or alternate indexers. |

## Static Analysis

- **Slither** runs in CI to detect common vulnerability patterns.
- **Solhint** enforces Solidity coding standards.
- **Forge fmt** ensures consistent formatting.
- Fuzz tests run 1,000 iterations per property.
- Invariant tests run 256 sequences of 64 calls each.
