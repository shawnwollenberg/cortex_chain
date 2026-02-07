# Threat Model

Security analysis for the Agent-Native Ethereum L2. This document covers MVP-level risks, mitigations, and assumptions.

## 1. Bridge / Rollup Risks

**Risk:** As an L2, the system inherits bridge and sequencer trust assumptions from the rollup framework.

| Threat | Severity | Mitigation |
|--------|----------|------------|
| Bridge exploit (token drain) | Critical | OP Stack canonical bridge; rely on L1 security. Monitor bridge balances. |
| Sequencer censorship | High | OP Stack forced inclusion via L1. Agents can submit L1 fallback txs. |
| Sequencer liveness failure | High | OP Stack permissionless proposer upgrade path. Document manual override procedure. |
| Data availability gap | Medium | L1 calldata/blobs ensure state reconstructability. |

**Assumptions:**
- We deploy on OP Stack (or Base/OP Sepolia) which inherits Ethereum L1 security guarantees.
- The canonical bridge is the only supported deposit/withdrawal path for MVP.

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
| Solver censorship | Medium | MVP: single trusted solver. Future: permissionless solver set with reputation. |
| Solver MEV extraction | Medium | Constraint enforcement on-chain (amountInMax/amountOutMin). Solver cannot exceed bounds. |
| Solver griefing (fill with bad data) | Low | Fill constraints checked on-chain. Invalid fills revert. |
| Solver downtime | Medium | Intents remain OPEN until deadline. Agents can cancel and resubmit. |

**Assumptions:**
- MVP uses a single, trusted solver operated by the team.
- MEV protection (encrypted mempools, batch auctions) is deferred to post-MVP.

## 4. Policy Bypass Patterns

**Risk:** Agents or attackers could bypass PolicyModule restrictions.

| Threat | Severity | Mitigation |
|--------|----------|------------|
| `delegatecall` to untrusted contract | High | PolicyAccount restricts execution to `call` only. `delegatecall` is not exposed. |
| `approve` + `transferFrom` bypass | Medium | Spend limits track `msg.value` (ETH) via `checkTransaction`. Token approvals require target allowlist. |
| Spend limit race (multi-tx in same block) | Low | `recordSpend()` uses storage-level cumulative tracking. Multiple calls in one block accumulate correctly. |
| Rolling window manipulation | Low | Window resets after 24h from `lastResetTimestamp`. Cannot be shortened by the account. |
| Target allowlist bypass via proxy | Medium | Allowlist checks the direct `target` address. Proxied targets must be explicitly allowlisted. |
| Function selector collision | Low | 4-byte selectors have collision potential but are practically safe for known interfaces. |

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

## 7. Offchain Service Risks

| Threat | Severity | Mitigation |
|--------|----------|------------|
| Indexer data desync | Medium | Indexer tracks `lastProcessedBlock` and resumes from checkpoint. API serves stale-but-safe data. |
| API injection (SQL) | High | All queries use parameterized statements (`$1`, `$2`). No string interpolation. |
| API denial of service | Medium | Pagination limits (max 100). No unbounded queries. |
| Database corruption | Medium | Postgres WAL + standard backup procedures. Indexer migrations are idempotent. |

## Static Analysis

- **Slither** runs in CI to detect common vulnerability patterns.
- **Solhint** enforces Solidity coding standards.
- **Forge fmt** ensures consistent formatting.
- Fuzz tests run 1,000 iterations per property.
- Invariant tests run 256 sequences of 64 calls each.
