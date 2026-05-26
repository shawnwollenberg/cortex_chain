# Design Decisions

Log of key architectural and implementation decisions.

## 1. Base-First Protocol Deployment

**Decision:** Deploy Cortex first as protocol contracts and services on Base/Base Sepolia rather than launching a new chain immediately.

**Rationale:** Base already has stablecoins, ERC-20 liquidity, wallets, explorers, developer distribution, and a credible path for agentic commerce adoption. Starting as a protocol keeps the system useful without requiring new bridged assets.

**Tradeoff:** Less control over execution, sequencing, and fee markets than a custom rollup. If agent activity later justifies deeper changes, the same primitives can become predeploys or chain-native modules.

## 2. Agent Identity as Contract Records (Not NFTs)

**Decision:** Store agent identity in a simple mapping (`uint256 => AgentRecord`) in `AgentRegistry`.

**Rationale:** Simpler than ERC-721. No transfer semantics needed — agents are permanently tied to their owner. Avoids NFT marketplace confusion.

**Tradeoff:** Cannot transfer agent identity. Acceptable for MVP; could add transfer later if needed.

## 3. EIP-712 Typed Data for Intent Signing

**Decision:** Use EIP-712 with domain separator for intent signing.

**Rationale:** Standard approach for off-chain signatures with on-chain verification. Includes chain ID and contract address for replay protection. Human-readable in wallet UIs.

**Tradeoff:** Requires more gas than simple `keccak256(abi.encodePacked(...))`. Worth it for security and UX.

## 4. Per-Owner Nonce (Not Sequential)

**Decision:** Use a `mapping(address => mapping(uint256 => bool))` for nonce tracking instead of sequential nonces.

**Rationale:** Agents may submit intents from multiple processes concurrently. Sequential nonces would require coordination. Boolean nonces allow any unused value.

**Tradeoff:** Higher storage costs (cannot pack nonces). Acceptable at current scale.

## 5. Lazy Intent Expiration

**Decision:** Check deadline in `fillIntent()` rather than a separate expiration process.

**Rationale:** Simpler. No keeper/cron needed. Expired intents remain OPEN in storage but cannot be filled. `getIntentStatus()` does not check expiry (returns storage value).

**Tradeoff:** Expired intents appear OPEN until someone attempts to fill them. The API/indexer can compute effective status.

## 6. PolicyModule as Separate Contract

**Decision:** Keep PolicyModule as a standalone contract rather than embedding logic in PolicyAccount.

**Rationale:** Multiple accounts can share the same PolicyModule. Policies are upgradeable independently of account code. Cleaner separation of concerns.

**Tradeoff:** Extra call overhead for policy checks. Negligible on Base for the current usage profile.

## 7. Permissionless Solver Registry, Hosted Solver First

**Decision:** Support permissionless solver registration and indexed solver quality, while still allowing an initial hosted solver for demos and early testnet flows.

**Rationale:** Agents need visible solver metadata, bids, bonds, and performance counters before trusting automated execution. A hosted solver keeps the demo path simple without making the protocol single-solver.

**Tradeoff:** Real production solver markets still need stronger incentives, monitoring, and potentially slashing or dispute mechanisms.

## 8. Express 4 for API

**Decision:** Use Express 4 with raw `pg` queries.

**Rationale:** Lightweight, widely known, stable. No ORM overhead. Consistent with indexer's database access pattern. App factory pattern (`createApp(pool)`) enables test injection.

**Tradeoff:** No built-in validation framework. Manual validation in each route. Acceptable for small endpoint surface.

## 9. Postgres Only (No OpenSearch)

**Decision:** Use Postgres as the sole data store for MVP.

**Rationale:** Sufficient for the query patterns needed. JSONB supports flexible event storage. Simpler operations than running OpenSearch.

**Tradeoff:** Full-text search on metadata would require Postgres FTS or adding OpenSearch later.

## 10. Address Normalization (Lowercase)

**Decision:** Store all addresses as lowercase hex strings in Postgres.

**Rationale:** Avoids case-sensitivity issues in queries. EVM addresses are case-insensitive; checksummed addresses are for display only.

**Tradeoff:** Cannot reconstruct EIP-55 checksum from stored value. Not needed for MVP.

## 11. NUMERIC/BIGINT as Strings in API

**Decision:** Return Postgres NUMERIC and BIGINT values as strings in JSON responses.

**Rationale:** JavaScript `Number` cannot represent values > 2^53. Smart contract values routinely exceed this. String representation preserves precision.

**Tradeoff:** Consumers must parse strings to BigInt. Standard practice in Ethereum tooling.

## 12. Shared Migration File

**Decision:** The API service reads the indexer's `001_init.sql` migration file.

**Rationale:** Single source of truth for schema. Both services need the same tables. Avoids schema drift.

**Tradeoff:** Creates a file-path dependency between services. Mitigated by trying multiple candidate paths and warning if not found.
