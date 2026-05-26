import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security — Cortex Docs",
  description: "Threat model, mitigations, and security invariants for Cortex.",
  alternates: { types: { "text/markdown": "/docs/security.md" } },
};

interface ThreatRow {
  threat: string;
  severity: string;
  mitigation: string;
}

function ThreatTable({ rows }: { rows: ThreatRow[] }) {
  return (
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="pb-3 pr-4">Threat</th>
            <th className="pb-3 pr-4">Severity</th>
            <th className="pb-3">Mitigation</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="py-2 pr-4">{r.threat}</td>
              <td className="py-2 pr-4">
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  r.severity === "Critical" ? "bg-red-500/20 text-red-400" :
                  r.severity === "High" ? "bg-orange-500/20 text-orange-400" :
                  r.severity === "Medium" ? "bg-yellow-500/20 text-yellow-400" :
                  "bg-green-500/20 text-green-400"
                }`}>
                  {r.severity}
                </span>
              </td>
              <td className="py-2 text-muted">{r.mitigation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Security</h1>
      <p className="text-muted mb-10">
        Threat model and security analysis for Cortex as a Base-native agentic commerce protocol.
        Covers protocol, policy, commerce, and offchain service risks.
      </p>

      {/* 1. Bridge */}
      <h2 className="text-xl font-semibold mb-4">1. Base / L2 Dependency Risks</h2>
      <ThreatTable rows={[
        { threat: "Bridge exploit (token drain)", severity: "Critical", mitigation: "Prefer native Base assets and canonical bridges. Monitor bridge and stablecoin issuer risk." },
        { threat: "Sequencer censorship", severity: "High", mitigation: "Base inherits OP Stack forced inclusion paths. Agents and merchants should retry or use alternate rails when degraded." },
        { threat: "Sequencer liveness failure", severity: "High", mitigation: "Document operational fallback and pause guidance for services that need timely settlement." },
        { threat: "Data availability gap", severity: "Medium", mitigation: "L1 calldata/blobs ensure state reconstructability." },
        { threat: "Public RPC range limits", severity: "Medium", mitigation: "Indexer chunks log polling below Base Sepolia RPC limits and checkpoints progress." },
      ]} />

      {/* 2. Intent */}
      <h2 className="text-xl font-semibold mb-4 mt-10">2. Intent Manipulation / Replay</h2>
      <ThreatTable rows={[
        { threat: "Intent replay (same chain)", severity: "High", mitigation: "Per-owner nonce mapping. Once used, permanently consumed." },
        { threat: "Intent replay (cross-chain)", severity: "Medium", mitigation: "EIP-712 domain includes chainId and verifyingContract." },
        { threat: "Intent forgery (wrong signer)", severity: "High", mitigation: "EIP-712 signature verification via ECDSA.recover." },
        { threat: "Intent front-running", severity: "Medium", mitigation: "MVP accepts this; future: encrypted mempools or commit-reveal." },
        { threat: "Expired intent fill", severity: "Low", mitigation: "fillIntent() checks block.timestamp >= deadline and reverts." },
        { threat: "Constraint violation", severity: "Low", mitigation: "fillIntent() enforces amountIn <= amountInMax and amountOut >= amountOutMin." },
      ]} />
      <div className="rounded-lg border border-border bg-surface p-4 mb-6 text-sm">
        <p className="font-semibold mb-2">Invariants verified by fuzz/invariant tests:</p>
        <ul className="list-disc list-inside space-y-1 text-muted">
          <li><code>invariant_noDoubleFill</code> &mdash; no intent can be filled twice</li>
          <li><code>invariant_nonceReplayProtection</code> &mdash; nonce replay always reverts</li>
          <li><code>invariant_statusConsistency</code> &mdash; filled + cancelled &lt;= submitted</li>
        </ul>
      </div>

      {/* 3. Solver */}
      <h2 className="text-xl font-semibold mb-4 mt-10">3. Solver Censorship or Abuse</h2>
      <ThreatTable rows={[
        { threat: "Solver censorship", severity: "Medium", mitigation: "Permissionless solver registration and indexed fill quality reduce reliance on one solver." },
        { threat: "Solver MEV extraction", severity: "Medium", mitigation: "Constraint enforcement on-chain (amountInMax/amountOutMin)." },
        { threat: "Solver griefing", severity: "Low", mitigation: "Fill constraints checked on-chain. Invalid fills revert." },
        { threat: "Solver downtime", severity: "Medium", mitigation: "Intents remain OPEN until deadline. Agents can cancel and resubmit." },
      ]} />

      {/* 4. Policy bypass */}
      <h2 className="text-xl font-semibold mb-4 mt-10">4. Policy Bypass Patterns</h2>
      <ThreatTable rows={[
        { threat: "delegatecall to untrusted contract", severity: "High", mitigation: "PolicyAccount restricts execution to call only." },
        { threat: "approve + transferFrom bypass", severity: "Medium", mitigation: "ERC-20 transfer, approve, and transferFrom calldata is detected and charged against token limits." },
        { threat: "Spend limit race (multi-tx)", severity: "Low", mitigation: "recordSpend() uses storage-level cumulative tracking." },
        { threat: "Rolling window manipulation", severity: "Low", mitigation: "Window resets after 24h. Cannot be shortened by the account." },
        { threat: "Target allowlist bypass via proxy", severity: "Medium", mitigation: "Allowlist checks direct target address." },
        { threat: "Function selector collision", severity: "Low", mitigation: "4-byte selectors practically safe for known interfaces." },
        { threat: "Signed payment replay", severity: "High", mitigation: "Signed payment recording enforces merchant/token/facilitator budgets and payment-hash replay protection." },
      ]} />
      <div className="rounded-lg border border-border bg-surface p-4 mb-6 text-sm">
        <p className="font-semibold mb-2">Invariants verified by fuzz/invariant tests:</p>
        <ul className="list-disc list-inside space-y-1 text-muted">
          <li><code>invariant_spentNeverExceedsPeakMax</code> &mdash; spentToday never exceeds peak maxPerDay</li>
          <li><code>invariant_windowResetClearsSpend</code> &mdash; window reset clears spending correctly</li>
          <li><code>invariant_perTokenIsolation</code> &mdash; per-token spending is isolated</li>
        </ul>
      </div>

      {/* 5. Key management */}
      <h2 className="text-xl font-semibold mb-4 mt-10">5. Key Management</h2>
      <ThreatTable rows={[
        { threat: "Agent key compromise", severity: "Critical", mitigation: "PolicyModule caps daily spending. Target allowlist limits destinations. Owner can revoke." },
        { threat: "Solver key compromise", severity: "High", mitigation: "Solver can only fill intents within constraints." },
        { threat: "Deployer key compromise", severity: "High", mitigation: "Contracts are immutable once deployed. Deployer not privileged." },
        { threat: "Key rotation", severity: "Medium", mitigation: "AgentRegistry supports updateAgent. Policies are reconfigurable." },
      ]} />

      {/* 6. Smart contract */}
      <h2 className="text-xl font-semibold mb-4 mt-10">6. Smart Contract Risks</h2>
      <ThreatTable rows={[
        { threat: "Reentrancy", severity: "Low", mitigation: "No external calls before state changes. Checks-effects-interactions." },
        { threat: "Integer overflow", severity: "Low", mitigation: "Solidity 0.8.24 built-in overflow checks." },
        { threat: "Storage collision", severity: "Low", mitigation: "No upgradeable proxies in MVP." },
        { threat: "Uninitialized state", severity: "Low", mitigation: "All mappings default to zero/false." },
      ]} />

      {/* 7. Offchain */}
      <h2 className="text-xl font-semibold mb-4 mt-10">7. Commerce Risks</h2>
      <ThreatTable rows={[
        { threat: "Fake merchant or cloned service", severity: "High", mitigation: "Merchant, service, and facilitator records are anchored onchain with metadata hashes." },
        { threat: "Quote replay", severity: "High", mitigation: "Quote hashes bind chain ID, registry address, merchant, service, agent, token, rail, nonce, terms, resource, x402 payload, and fees." },
        { threat: "Payment payload substitution", severity: "High", mitigation: "x402 payloads bind through x402PayloadHash; other rails bind through terms/resource hashes plus account policy." },
        { threat: "Merchant non-fulfillment", severity: "Medium", mitigation: "Receipts, fulfillment hashes, disputes, and trust signals create a shared risk trail." },
        { threat: "Refund abuse by agents", severity: "Medium", mitigation: "Dispute and trust-signal history is indexed for agents and merchants." },
        { threat: "Privacy leakage in metadata", severity: "Medium", mitigation: "Keep sensitive prompts, URLs, payloads, and business intent out of public metadata." },
      ]} />

      {/* 8. Offchain */}
      <h2 className="text-xl font-semibold mb-4 mt-10">8. Offchain Service Risks</h2>
      <ThreatTable rows={[
        { threat: "Indexer data desync", severity: "Medium", mitigation: "Tracks lastProcessedBlock. Resumes from checkpoint." },
        { threat: "API injection (SQL)", severity: "High", mitigation: "All queries use parameterized statements ($1, $2)." },
        { threat: "API denial of service", severity: "Medium", mitigation: "Pagination limits (max 100). No unbounded queries." },
        { threat: "Database corruption", severity: "Medium", mitigation: "Postgres WAL + standard backup. Idempotent migrations." },
        { threat: "Hosted API outage", severity: "Medium", mitigation: "Onchain state remains canonical; agents can fall back to direct RPC/log reads or alternate indexers." },
      ]} />

      <h2 className="text-xl font-semibold mb-4 mt-10">Static Analysis</h2>
      <ul className="list-disc list-inside space-y-2 text-sm text-muted">
        <li><strong>Slither</strong> runs in CI to detect common vulnerability patterns.</li>
        <li><strong>Solhint</strong> enforces Solidity coding standards.</li>
        <li><strong>Forge fmt</strong> ensures consistent formatting.</li>
        <li>Fuzz tests run 1,000 iterations per property.</li>
        <li>Invariant tests run 256 sequences of 64 calls each.</li>
      </ul>
    </div>
  );
}
