import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design Decisions — Cortex Docs",
  description: "Key architectural and implementation decisions for Cortex.",
  alternates: { types: { "text/markdown": "/docs/decisions.md" } },
};

const DECISIONS = [
  {
    id: 1,
    title: "OP Stack as Rollup Framework",
    decision: "Target OP Stack (Base/OP Sepolia) for deployment.",
    rationale: "Most mature general-purpose L2 framework. Shared sequencer and bridge infrastructure. Large developer ecosystem. Forced inclusion via L1 for censorship resistance.",
    tradeoff: "Less customizable than building a custom rollup. Sufficient for MVP.",
  },
  {
    id: 2,
    title: "Agent Identity as Contract Records (Not NFTs)",
    decision: "Store agent identity in a simple mapping (uint256 => AgentRecord) in AgentRegistry.",
    rationale: "Simpler than ERC-721. No transfer semantics needed — agents are permanently tied to their owner. Avoids NFT marketplace confusion.",
    tradeoff: "Cannot transfer agent identity. Acceptable for MVP; could add transfer later if needed.",
  },
  {
    id: 3,
    title: "EIP-712 Typed Data for Intent Signing",
    decision: "Use EIP-712 with domain separator for intent signing.",
    rationale: "Standard approach for off-chain signatures with on-chain verification. Includes chain ID and contract address for replay protection. Human-readable in wallet UIs.",
    tradeoff: "Requires more gas than simple keccak256(abi.encodePacked(...)). Worth it for security and UX.",
  },
  {
    id: 4,
    title: "Per-Owner Nonce (Not Sequential)",
    decision: "Use a mapping(address => mapping(uint256 => bool)) for nonce tracking instead of sequential nonces.",
    rationale: "Agents may submit intents from multiple processes concurrently. Sequential nonces would require coordination. Boolean nonces allow any unused value.",
    tradeoff: "Higher storage costs (cannot pack nonces). Acceptable at current scale.",
  },
  {
    id: 5,
    title: "Lazy Intent Expiration",
    decision: "Check deadline in fillIntent() rather than a separate expiration process.",
    rationale: "Simpler. No keeper/cron needed. Expired intents remain OPEN in storage but cannot be filled. getIntentStatus() returns storage value.",
    tradeoff: "Expired intents appear OPEN until someone attempts to fill them. The API/indexer can compute effective status.",
  },
  {
    id: 6,
    title: "PolicyModule as Separate Contract",
    decision: "Keep PolicyModule as a standalone contract rather than embedding logic in PolicyAccount.",
    rationale: "Multiple accounts can share the same PolicyModule. Policies are upgradeable independently of account code. Cleaner separation of concerns.",
    tradeoff: "Extra call overhead for policy checks. Negligible on L2.",
  },
  {
    id: 7,
    title: "Single Trusted Solver (MVP)",
    decision: "Run one solver instance operated by the team.",
    rationale: "Simplest path to a working demo. Permissionless solver registration adds complexity (reputation, staking, slashing) without MVP value.",
    tradeoff: "Centralization risk. Documented in threat model. Future: permissionless solver set.",
  },
  {
    id: 8,
    title: "Express 4 for API",
    decision: "Use Express 4 with raw pg queries.",
    rationale: "Lightweight, widely known, stable. No ORM overhead. Consistent with indexer's database access pattern. App factory pattern (createApp(pool)) enables test injection.",
    tradeoff: "No built-in validation framework. Manual validation in each route. Acceptable for small endpoint surface.",
  },
  {
    id: 9,
    title: "Postgres Only (No OpenSearch)",
    decision: "Use Postgres as the sole data store for MVP.",
    rationale: "Sufficient for the query patterns needed. JSONB supports flexible event storage. Simpler operations than running OpenSearch.",
    tradeoff: "Full-text search on metadata would require Postgres FTS or adding OpenSearch later.",
  },
  {
    id: 10,
    title: "Address Normalization (Lowercase)",
    decision: "Store all addresses as lowercase hex strings in Postgres.",
    rationale: "Avoids case-sensitivity issues in queries. EVM addresses are case-insensitive; checksummed addresses are for display only.",
    tradeoff: "Cannot reconstruct EIP-55 checksum from stored value. Not needed for MVP.",
  },
  {
    id: 11,
    title: "NUMERIC/BIGINT as Strings in API",
    decision: "Return Postgres NUMERIC and BIGINT values as strings in JSON responses.",
    rationale: "JavaScript Number cannot represent values > 2^53. Smart contract values routinely exceed this. String representation preserves precision.",
    tradeoff: "Consumers must parse strings to BigInt. Standard practice in Ethereum tooling.",
  },
  {
    id: 12,
    title: "Shared Migration File",
    decision: "The API service reads the indexer's 001_init.sql migration file.",
    rationale: "Single source of truth for schema. Both services need the same tables. Avoids schema drift.",
    tradeoff: "Creates a file-path dependency between services. Mitigated by trying multiple candidate paths and warning if not found.",
  },
];

export default function DecisionsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Design Decisions</h1>
      <p className="text-muted mb-10">
        Log of key architectural and implementation decisions.
      </p>

      <div className="space-y-8">
        {DECISIONS.map((d) => (
          <div key={d.id} className="rounded-lg border border-border bg-surface p-5">
            <h3 className="font-semibold mb-3">
              <span className="text-muted mr-2">#{d.id}</span>
              {d.title}
            </h3>
            <div className="space-y-2 text-sm">
              <p><strong>Decision:</strong> <span className="text-muted">{d.decision}</span></p>
              <p><strong>Rationale:</strong> <span className="text-muted">{d.rationale}</span></p>
              <p><strong>Tradeoff:</strong> <span className="text-muted">{d.tradeoff}</span></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
