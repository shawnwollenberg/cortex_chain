import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "Architecture — Cortex Docs",
  description: "System architecture, commerce flow, payment rails, and indexed data for Cortex.",
  alternates: { types: { "text/markdown": "/docs/architecture.md" } },
};

const CONTRACTS = [
  ["AgentRegistry", "Agent identity", "Owner, metadata URI, pubkey, capabilities hash"],
  ["PolicyModule", "Policy enforcement", "Spend limits, allowlists, signed payment policy, replay protection"],
  ["PolicyAccount", "Smart account", "Policy-gated execution, session keys, guardian freeze"],
  ["IntentBook", "Intent lifecycle", "EIP-712 intents, selected bids, solver fill enforcement"],
  ["SolverRegistry", "Solver discovery", "Operator metadata, bond, fill quality counters"],
  ["AttestorRegistry", "Attestor discovery", "Operator metadata and schema support"],
  ["AttestationRegistry", "Provenance", "Schema-based attestations and revocation"],
  ["CommerceRegistry", "Agentic commerce", "Merchants, services, facilitators, quotes, receipts, fulfillment, trust signals, disputes"],
];

const TABLES = [
  ["agents", "Agent identity and owner lookups"],
  ["intents", "Intent state, constraints, and status"],
  ["solver_bids", "Bid market inspection"],
  ["fills", "Solver fills, result hashes, trace hashes"],
  ["policies", "Account spend, allowlist, and signed payment policy state"],
  ["solvers", "Solver metadata and performance metrics"],
  ["attestors", "Attestor metadata and counters"],
  ["merchants", "Merchant discovery and payout context"],
  ["services", "Service discovery and capability lookup"],
  ["facilitators", "Payment facilitator discovery"],
  ["quotes", "Canonical quote/payment terms and fee instrumentation"],
  ["commerce_receipts", "Settled commerce records and fulfillment hashes"],
  ["disputes", "Refund/dispute/reputation signals"],
  ["trust_signals", "Verification, risk, compliance, and fulfillment signals"],
  ["tx_receipts", "Human and machine transaction explanations"],
];

export default function ArchitecturePage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Architecture</h1>
      <p className="text-muted mb-10">
        Cortex is a Base-native protocol for agentic commerce: onchain identity, policy,
        intents, merchant discovery, payment terms, receipts, disputes, analytics, and
        machine-readable APIs.
      </p>

      <h2 className="text-xl font-semibold mb-4">System Shape</h2>
      <CodeBlock language="text">{`Agent / Smart Account
  -> AgentRegistry + PolicyModule + PolicyAccount
  -> IntentBook <-> SolverRegistry / Solver service

Merchant / Service Operator
  -> CommerceRegistry
     merchants, services, facilitators, quotes, receipts, fulfillment, trust signals, disputes

Attestors
  -> AttestorRegistry + AttestationRegistry

All contract events
  -> Indexer -> Postgres -> REST API / MCP / Dashboard`}</CodeBlock>

      <h2 className="text-xl font-semibold mb-4 mt-10">Core Flows</h2>
      <ol className="list-decimal list-inside space-y-3 text-sm mb-10">
        <li><strong>Agent identity and policy</strong> — register an agent, configure spend limits, target/function allowlists, session keys, and signed payment budgets.</li>
        <li><strong>Intent execution</strong> — sign an EIP-712 intent, inspect/select solver bids, and enforce selected solver, amounts, execution commitment, deadline, and optional attestations.</li>
        <li><strong>Merchant discovery</strong> — register merchant, service, facilitator, metadata URI/hash, and service capability hash onchain.</li>
        <li><strong>Quote commitment</strong> — bind merchant, service, agent, token, amount, payment rail, expiry, nonce, resource hash, terms hash, optional x402 payload hash, and fee terms.</li>
        <li><strong>Receipt, fulfillment, and dispute</strong> — record settlement, result/resource hashes, fulfillment hashes, trust signals, and dispute resolution signals for analytics and reputation.</li>
        <li><strong>Index and query</strong> — index events into Postgres and expose them through REST, MCP, and dashboard views.</li>
      </ol>

      <h2 className="text-xl font-semibold mb-4">Payment Rails</h2>
      <div className="grid gap-3 sm:grid-cols-2 mb-10">
        {[
          ["Wallet transfers", "Native or ERC-20 payments governed by spend limits and allowlists."],
          ["Swaps", "DEX/router calls governed by intent constraints, target policies, and token spend limits."],
          ["Facilitators", "Delegated payment flows where a facilitator settles on behalf of an authorization."],
          ["x402", "Web-native payment acceptance bound through x402PayloadHash when used."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-lg border border-border bg-surface p-4">
            <h3 className="font-semibold mb-2">{title}</h3>
            <p className="text-sm text-muted leading-6">{body}</p>
          </div>
        ))}
      </div>

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
            {CONTRACTS.map(([contract, purpose, feature]) => (
              <tr key={contract}>
                <td className="py-3 pr-4 font-mono text-xs">{contract}</td>
                <td className="py-3 pr-4">{purpose}</td>
                <td className="py-3 text-muted">{feature}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold mb-4">Indexed Data</h2>
      <div className="overflow-x-auto mb-10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="pb-3 pr-4">Table</th>
              <th className="pb-3">Purpose</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {TABLES.map(([table, purpose]) => (
              <tr key={table}>
                <td className="py-3 pr-4 font-mono text-xs">{table}</td>
                <td className="py-3 text-muted">{purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold mb-4">API, MCP, and Dashboard</h2>
      <ul className="list-disc list-inside space-y-2 text-sm text-muted mb-10">
        <li>REST API exposes indexed state for agents and frontends.</li>
        <li>MCP tools expose selected API functionality to model-driven agents.</li>
        <li>Dashboard reads commerce analytics, merchant/service discovery, receipts, and disputes.</li>
        <li>Analytics include volume, settled volume, payment rail mix, zero-fee protocol fields, dispute counts, trust signal counts, and facilitator/merchant/service leaderboards.</li>
      </ul>

      <h2 className="text-xl font-semibold mb-4">Technology Stack</h2>
      <CodeBlock language="text">{`Contracts:      Solidity 0.8.24, Foundry, OpenZeppelin
Solver:         TypeScript, viem, node-postgres
Indexer:        TypeScript, viem, node-postgres
API:            TypeScript, Express 4, node-postgres
Dashboard/docs: Next.js, React, Tailwind
Database:       PostgreSQL 16
Local dev:      Anvil, Docker Compose`}</CodeBlock>
    </div>
  );
}
