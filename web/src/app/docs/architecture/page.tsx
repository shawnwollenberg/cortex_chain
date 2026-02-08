import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "Architecture — Cortex Docs",
  description: "System architecture, data flow, and database schema for Cortex.",
  alternates: { types: { "text/markdown": "/docs/architecture.md" } },
};

export default function ArchitecturePage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Architecture</h1>
      <p className="text-muted mb-10">
        Cortex is a vertically integrated stack of onchain contracts and offchain services.
      </p>

      <h2 className="text-xl font-semibold mb-4">Data Flow</h2>
      <ol className="list-decimal list-inside space-y-3 text-sm mb-10">
        <li><strong>Agent registers</strong> &mdash; calls <code>AgentRegistry.registerAgent()</code> &rarr; emits <code>AgentRegistered</code></li>
        <li><strong>Agent configures policies</strong> &mdash; calls <code>PolicyModule.setSpendLimit()</code>, <code>setTargetAllowed()</code></li>
        <li><strong>Agent signs intent</strong> &mdash; EIP-712 typed data (domain: &quot;AgentIntentBook&quot;, version &quot;1&quot;, chainId, verifyingContract)</li>
        <li><strong>Agent submits intent</strong> &mdash; calls <code>IntentBook.submitIntent(intent, v, r, s)</code> &rarr; emits <code>IntentSubmitted</code></li>
        <li><strong>Solver watches</strong> &mdash; polls for events &rarr; validates &rarr; simulates via <code>eth_call</code> &rarr; calls <code>fillIntent()</code></li>
        <li><strong>Indexer ingests</strong> &mdash; polls all contract events &rarr; writes to Postgres</li>
        <li><strong>API serves</strong> &mdash; queries Postgres &rarr; returns JSON to agents or frontends</li>
      </ol>

      <h2 className="text-xl font-semibold mb-4">Contract Architecture</h2>
      <div className="overflow-x-auto mb-10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="pb-3 pr-4">Contract</th>
              <th className="pb-3 pr-4">Purpose</th>
              <th className="pb-3">Key Feature</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr><td className="py-3 pr-4 font-mono text-xs">AgentRegistry</td><td className="py-3 pr-4">Agent identity</td><td className="py-3 text-muted">owner, metadataURI, pubkey, capabilitiesHash</td></tr>
            <tr><td className="py-3 pr-4 font-mono text-xs">IntentBook</td><td className="py-3 pr-4">Intent lifecycle</td><td className="py-3 text-muted">EIP-712, nonce replay protection, constraints</td></tr>
            <tr><td className="py-3 pr-4 font-mono text-xs">PolicyModule</td><td className="py-3 pr-4">Policy enforcement</td><td className="py-3 text-muted">Daily spend limits, target + function allowlists</td></tr>
            <tr><td className="py-3 pr-4 font-mono text-xs">PolicyAccount</td><td className="py-3 pr-4">ERC-4337 account</td><td className="py-3 text-muted">Delegates validation to PolicyModule</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold mb-4">Database Schema</h2>
      <div className="overflow-x-auto mb-10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="pb-3 pr-4">Table</th>
              <th className="pb-3 pr-4">Indexed From</th>
              <th className="pb-3">Key Columns</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr><td className="py-3 pr-4 font-mono text-xs">agents</td><td className="py-3 pr-4 text-muted">AgentRegistered, AgentUpdated, AgentRevoked</td><td className="py-3 text-muted">agent_id, owner, metadata_uri, revoked</td></tr>
            <tr><td className="py-3 pr-4 font-mono text-xs">intents</td><td className="py-3 pr-4 text-muted">IntentSubmitted, IntentCancelled</td><td className="py-3 text-muted">intent_id, owner, status, input_token, output_token</td></tr>
            <tr><td className="py-3 pr-4 font-mono text-xs">fills</td><td className="py-3 pr-4 text-muted">IntentFilled</td><td className="py-3 text-muted">intent_id, solver, amount_in, amount_out</td></tr>
            <tr><td className="py-3 pr-4 font-mono text-xs">policies</td><td className="py-3 pr-4 text-muted">SpendLimitSet, TargetAllowlist*, FunctionAllowlist*</td><td className="py-3 text-muted">account, policy_type, token/target</td></tr>
            <tr><td className="py-3 pr-4 font-mono text-xs">tx_receipts</td><td className="py-3 pr-4 text-muted">All transactions</td><td className="py-3 text-muted">tx_hash, block_number, events (JSONB)</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold mb-4">Technology Stack</h2>
      <CodeBlock language="text">{`Contracts:  Solidity 0.8.24, Foundry, OpenZeppelin
Solver:     TypeScript, viem, node-postgres
Indexer:    TypeScript, viem, node-postgres
API:        TypeScript, Express 4, node-postgres
Database:   PostgreSQL 16
Local dev:  Anvil (Foundry), Docker Compose`}</CodeBlock>
    </div>
  );
}
