import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "Local Development — Cortex Docs",
  description: "Run the entire Cortex stack locally in under 5 minutes.",
  alternates: { types: { "text/markdown": "/docs/local-dev.md" } },
};

export default function LocalDevPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Local Development</h1>
      <p className="text-muted mb-10">
        Run the entire Agent-Native L2 stack locally in under 5 minutes.
      </p>

      <h2 className="text-xl font-semibold mb-4">Prerequisites</h2>
      <ul className="list-disc list-inside space-y-2 text-sm text-muted mb-8">
        <li><strong>Docker</strong> &mdash; for Anvil + Postgres containers</li>
        <li><strong>Foundry</strong> &mdash; <code>forge</code>, <code>cast</code>, <code>anvil</code></li>
        <li><strong>Node.js</strong> &gt;= 18</li>
        <li><strong>PostgreSQL client tools</strong> &mdash; <code>psql</code>, <code>pg_isready</code></li>
      </ul>

      <h2 className="text-xl font-semibold mb-4">Quick Start</h2>
      <CodeBlock language="bash">{`make install   # first time only — installs all deps
make e2e       # starts infra, deploys, launches services, runs demo`}</CodeBlock>

      <h2 className="text-xl font-semibold mb-4 mt-10">Step-by-Step</h2>

      <h3 className="text-lg font-semibold mb-2">1. Install Dependencies</h3>
      <CodeBlock language="bash">{`make install`}</CodeBlock>

      <h3 className="text-lg font-semibold mb-2 mt-6">2. Start Infrastructure</h3>
      <p className="text-sm text-muted mb-2">Starts Anvil (local EVM on port 8545) and Postgres (port 5433) via Docker Compose.</p>
      <CodeBlock language="bash">{`make up`}</CodeBlock>

      <h3 className="text-lg font-semibold mb-2 mt-6">3. Deploy Contracts</h3>
      <p className="text-sm text-muted mb-2">
        Deploys AgentRegistry, IntentBook, and PolicyModule to Anvil. Writes addresses and keys to <code>ops/.env.deployed</code>.
      </p>
      <CodeBlock language="bash">{`make deploy`}</CodeBlock>

      <h3 className="text-lg font-semibold mb-2 mt-6">4. Start Services</h3>
      <p className="text-sm text-muted mb-2">Starts the indexer, solver, and API as background processes.</p>
      <CodeBlock language="bash">{`make services`}</CodeBlock>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted mt-2 mb-4">
        <li><strong>Indexer</strong> &mdash; polls Anvil for contract events, writes to Postgres</li>
        <li><strong>Solver</strong> &mdash; watches for open intents, simulates and fills them</li>
        <li><strong>API</strong> &mdash; REST server on <code>http://localhost:3000</code></li>
      </ul>
      <p className="text-sm text-muted">Logs: <code>ops/indexer.log</code>, <code>ops/solver.log</code>, <code>ops/api.log</code></p>

      <h3 className="text-lg font-semibold mb-2 mt-6">5. Run the Demo</h3>
      <CodeBlock language="bash">{`make demo`}</CodeBlock>
      <p className="text-sm text-muted mb-2">The demo:</p>
      <ol className="list-decimal list-inside space-y-1 text-sm text-muted mb-4">
        <li>Registers an agent identity</li>
        <li>Sets spend limit and target allowlist policies</li>
        <li>Submits an EIP-712 signed swap intent</li>
        <li>Waits for the solver to fill the intent</li>
        <li>Queries all API endpoints and prints results</li>
      </ol>

      <h3 className="text-lg font-semibold mb-2 mt-6">6. Tear Down</h3>
      <CodeBlock language="bash">{`make down    # stop services + infra
make clean   # also remove volumes and generated files`}</CodeBlock>

      <h2 className="text-xl font-semibold mb-4 mt-10">Useful Commands</h2>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-muted"><th className="pb-3 pr-4">Command</th><th className="pb-3">Description</th></tr></thead>
          <tbody className="divide-y divide-border">
            <tr><td className="py-2 pr-4 font-mono text-xs">make up</td><td className="py-2 text-muted">Start Anvil + Postgres</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">make deploy</td><td className="py-2 text-muted">Deploy contracts</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">make services</td><td className="py-2 text-muted">Start indexer/solver/API</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">make demo</td><td className="py-2 text-muted">Run end-to-end demo</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">make down</td><td className="py-2 text-muted">Stop everything</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">make clean</td><td className="py-2 text-muted">Full cleanup</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">make logs</td><td className="py-2 text-muted">Tail all service logs</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">make e2e</td><td className="py-2 text-muted">Full end-to-end in one shot</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold mb-4">Ports</h2>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-muted"><th className="pb-3 pr-4">Service</th><th className="pb-3">Port</th></tr></thead>
          <tbody className="divide-y divide-border">
            <tr><td className="py-2 pr-4">Anvil (RPC)</td><td className="py-2 font-mono text-xs">8545</td></tr>
            <tr><td className="py-2 pr-4">Postgres</td><td className="py-2 font-mono text-xs">5433</td></tr>
            <tr><td className="py-2 pr-4">REST API</td><td className="py-2 font-mono text-xs">3000</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold mb-4">Troubleshooting</h2>
      <ul className="space-y-3 text-sm">
        <li><strong>Anvil not starting:</strong> <span className="text-muted">Check if port 8545 is in use (<code>lsof -i :8545</code>).</span></li>
        <li><strong>Postgres connection refused:</strong> <span className="text-muted">Ensure Docker is running and port 5433 is free.</span></li>
        <li><strong>Solver not filling intents:</strong> <span className="text-muted">Check <code>ops/solver.log</code>. Needs valid <code>INTENT_BOOK_ADDRESS</code>.</span></li>
        <li><strong>API returns empty results:</strong> <span className="text-muted">Indexer may need a few seconds to catch up. Check <code>ops/indexer.log</code>.</span></li>
      </ul>
    </div>
  );
}
