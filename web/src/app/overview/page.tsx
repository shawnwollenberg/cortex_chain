import type { Metadata } from "next";
import DataFlowDiagram from "@/components/DataFlowDiagram";

export const metadata: Metadata = {
  title: "Architecture Overview — Cortex",
  description: "System architecture and data flow for the Cortex agent-native L2.",
};

export default function OverviewPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-3xl md:text-4xl font-bold mb-4">Architecture Overview</h1>
      <p className="text-muted mb-12 max-w-2xl">
        Cortex is a vertically integrated stack: onchain contracts handle identity, policies,
        and intents, while offchain services index events and serve machine-readable APIs.
      </p>

      <h2 className="text-xl font-semibold mb-6">System Diagram</h2>
      <div className="rounded-xl border border-border bg-surface p-4 mb-16">
        <DataFlowDiagram />
      </div>

      <h2 className="text-xl font-semibold mb-6">Data Flow</h2>
      <ol className="space-y-4 text-sm leading-relaxed">
        <li className="flex gap-3">
          <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-accent-purple/20 text-accent-purple text-xs font-bold">1</span>
          <span><strong>Agent registers</strong> &mdash; calls <code>AgentRegistry.registerAgent()</code>, emits <code>AgentRegistered</code>.</span>
        </li>
        <li className="flex gap-3">
          <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-accent-purple/20 text-accent-purple text-xs font-bold">2</span>
          <span><strong>Agent configures policies</strong> &mdash; calls <code>PolicyModule.setSpendLimit()</code>, <code>setTargetAllowed()</code>.</span>
        </li>
        <li className="flex gap-3">
          <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-accent-purple/20 text-accent-purple text-xs font-bold">3</span>
          <span><strong>Agent signs intent</strong> &mdash; EIP-712 typed data with domain &quot;AgentIntentBook&quot;, version &quot;1&quot;, chainId, verifyingContract.</span>
        </li>
        <li className="flex gap-3">
          <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-accent-purple/20 text-accent-purple text-xs font-bold">4</span>
          <span><strong>Agent submits intent</strong> &mdash; calls <code>IntentBook.submitIntent(intent, v, r, s)</code>, emits <code>IntentSubmitted</code>.</span>
        </li>
        <li className="flex gap-3">
          <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-accent-purple/20 text-accent-purple text-xs font-bold">5</span>
          <span><strong>Solver watches &amp; fills</strong> &mdash; polls events, validates constraints, simulates via <code>eth_call</code>, calls <code>fillIntent()</code>.</span>
        </li>
        <li className="flex gap-3">
          <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-accent-purple/20 text-accent-purple text-xs font-bold">6</span>
          <span><strong>Indexer ingests</strong> &mdash; polls all contract events, writes to Postgres tables.</span>
        </li>
        <li className="flex gap-3">
          <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-accent-purple/20 text-accent-purple text-xs font-bold">7</span>
          <span><strong>API serves</strong> &mdash; queries Postgres, returns JSON to agents or frontends.</span>
        </li>
      </ol>

      <h2 className="text-xl font-semibold mt-16 mb-6">Contract Architecture</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="pb-3 pr-4">Contract</th>
              <th className="pb-3 pr-4">Purpose</th>
              <th className="pb-3">Key Feature</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr><td className="py-3 pr-4 font-mono text-xs">AgentRegistry</td><td className="py-3 pr-4">Agent identity</td><td className="py-3 text-muted">Stores owner, metadataURI, pubkey, capabilitiesHash</td></tr>
            <tr><td className="py-3 pr-4 font-mono text-xs">IntentBook</td><td className="py-3 pr-4">Intent lifecycle</td><td className="py-3 text-muted">EIP-712 signing, nonce replay protection, constraint enforcement</td></tr>
            <tr><td className="py-3 pr-4 font-mono text-xs">PolicyModule</td><td className="py-3 pr-4">Policy enforcement</td><td className="py-3 text-muted">Daily spend limits, target allowlist, function selector allowlist</td></tr>
            <tr><td className="py-3 pr-4 font-mono text-xs">PolicyAccount</td><td className="py-3 pr-4">ERC-4337 account</td><td className="py-3 text-muted">Delegates validation to PolicyModule, signature verification</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold mt-16 mb-6">Technology Stack</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="pb-3 pr-4">Layer</th>
              <th className="pb-3">Stack</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr><td className="py-3 pr-4 font-semibold">Contracts</td><td className="py-3 text-muted">Solidity 0.8.24, Foundry, OpenZeppelin</td></tr>
            <tr><td className="py-3 pr-4 font-semibold">Solver</td><td className="py-3 text-muted">TypeScript, viem, node-postgres</td></tr>
            <tr><td className="py-3 pr-4 font-semibold">Indexer</td><td className="py-3 text-muted">TypeScript, viem, node-postgres</td></tr>
            <tr><td className="py-3 pr-4 font-semibold">API</td><td className="py-3 text-muted">TypeScript, Express 4, node-postgres</td></tr>
            <tr><td className="py-3 pr-4 font-semibold">Database</td><td className="py-3 text-muted">PostgreSQL 16</td></tr>
            <tr><td className="py-3 pr-4 font-semibold">Local dev</td><td className="py-3 text-muted">Anvil (Foundry), Docker Compose</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
