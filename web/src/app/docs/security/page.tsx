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
        Threat model and security analysis for the Cortex agent-native L2. Covers MVP-level risks, mitigations, and assumptions.
      </p>

      {/* 1. Bridge */}
      <h2 className="text-xl font-semibold mb-4">1. Bridge / Rollup Risks</h2>
      <ThreatTable rows={[
        { threat: "Bridge exploit (token drain)", severity: "Critical", mitigation: "OP Stack canonical bridge; rely on L1 security. Monitor bridge balances." },
        { threat: "Sequencer censorship", severity: "High", mitigation: "OP Stack forced inclusion via L1. Agents can submit L1 fallback txs." },
        { threat: "Sequencer liveness failure", severity: "High", mitigation: "OP Stack permissionless proposer upgrade path." },
        { threat: "Data availability gap", severity: "Medium", mitigation: "L1 calldata/blobs ensure state reconstructability." },
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
        { threat: "Solver censorship", severity: "Medium", mitigation: "MVP: single trusted solver. Future: permissionless solver set." },
        { threat: "Solver MEV extraction", severity: "Medium", mitigation: "Constraint enforcement on-chain (amountInMax/amountOutMin)." },
        { threat: "Solver griefing", severity: "Low", mitigation: "Fill constraints checked on-chain. Invalid fills revert." },
        { threat: "Solver downtime", severity: "Medium", mitigation: "Intents remain OPEN until deadline. Agents can cancel and resubmit." },
      ]} />

      {/* 4. Policy bypass */}
      <h2 className="text-xl font-semibold mb-4 mt-10">4. Policy Bypass Patterns</h2>
      <ThreatTable rows={[
        { threat: "delegatecall to untrusted contract", severity: "High", mitigation: "PolicyAccount restricts execution to call only." },
        { threat: "approve + transferFrom bypass", severity: "Medium", mitigation: "Spend limits track msg.value. Token approvals require target allowlist." },
        { threat: "Spend limit race (multi-tx)", severity: "Low", mitigation: "recordSpend() uses storage-level cumulative tracking." },
        { threat: "Rolling window manipulation", severity: "Low", mitigation: "Window resets after 24h. Cannot be shortened by the account." },
        { threat: "Target allowlist bypass via proxy", severity: "Medium", mitigation: "Allowlist checks direct target address." },
        { threat: "Function selector collision", severity: "Low", mitigation: "4-byte selectors practically safe for known interfaces." },
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
      <h2 className="text-xl font-semibold mb-4 mt-10">7. Offchain Service Risks</h2>
      <ThreatTable rows={[
        { threat: "Indexer data desync", severity: "Medium", mitigation: "Tracks lastProcessedBlock. Resumes from checkpoint." },
        { threat: "API injection (SQL)", severity: "High", mitigation: "All queries use parameterized statements ($1, $2)." },
        { threat: "API denial of service", severity: "Medium", mitigation: "Pagination limits (max 100). No unbounded queries." },
        { threat: "Database corruption", severity: "Medium", mitigation: "Postgres WAL + standard backup. Idempotent migrations." },
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
