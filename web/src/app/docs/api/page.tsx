import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "REST API — Cortex Docs",
  description: "REST API endpoint reference for the Cortex agent-native L2.",
  alternates: { types: { "text/markdown": "/docs/api.md" } },
};

export default function ApiPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">REST API Reference</h1>
      <p className="text-muted mb-10">
        Base URL: <code>http://localhost:3001</code> (configurable via <code>API_PORT</code>)
      </p>

      {/* Health */}
      <h2 className="text-xl font-semibold mb-3">Health Check</h2>
      <p className="text-sm text-muted mb-2"><code>GET /health</code></p>
      <CodeBlock language="json">{`{ "status": "ok" }`}</CodeBlock>

      <hr className="border-border my-8" />

      {/* Agents */}
      <h2 className="text-xl font-semibold mb-4">Agents</h2>

      <h3 className="text-lg font-semibold mb-2">Get Agent by ID</h3>
      <p className="text-sm text-muted mb-2"><code>GET /agents/:agentId</code></p>
      <CodeBlock language="json">{`{
  "agent_id": "1",
  "owner": "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
  "metadata_uri": "ipfs://agent-meta",
  "pubkey": "0xaabb",
  "capabilities_hash": "0x...",
  "revoked": false,
  "block_number": "10"
}`}</CodeBlock>
      <p className="text-sm text-muted mb-6">Errors: <code>400</code> (invalid ID), <code>404</code> (not found)</p>

      <h3 className="text-lg font-semibold mb-2">List Agents by Owner</h3>
      <p className="text-sm text-muted mb-2"><code>GET /agents?owner=0x...&amp;limit=50&amp;offset=0</code></p>
      <p className="text-sm text-muted mb-2">The <code>owner</code> parameter is required.</p>
      <CodeBlock language="json">{`{
  "agents": [...],
  "pagination": { "limit": 50, "offset": 0, "count": 1 }
}`}</CodeBlock>

      <hr className="border-border my-8" />

      {/* Intents */}
      <h2 className="text-xl font-semibold mb-4">Intents</h2>

      <h3 className="text-lg font-semibold mb-2">Get Intent by ID</h3>
      <p className="text-sm text-muted mb-2"><code>GET /intents/:id</code></p>
      <CodeBlock language="json">{`{
  "intent_id": "1",
  "owner": "0x...",
  "intent_type": "SWAP_EXACT_IN_MAX_SLIPPAGE",
  "input_token": "0x...",
  "output_token": "0x...",
  "amount_in_max": "1000000000000000000000",
  "amount_out_min": "900000000000000000000",
  "deadline": "1738965600",
  "slippage_bps": "100",
  "nonce": "42",
  "status": "FILLED",
  "block_number": "15",
  "fill": {
    "solver": "0x...",
    "amount_in": "950000000000000000000",
    "amount_out": "900000000000000000000",
    "tx_hash": "0x...",
    "block_number": "18"
  }
}`}</CodeBlock>
      <p className="text-sm text-muted mb-6">If the intent is not filled, <code>fill</code> is <code>null</code>.</p>

      <h3 className="text-lg font-semibold mb-2">List Intents</h3>
      <p className="text-sm text-muted mb-2"><code>GET /intents?status=open&amp;limit=50&amp;offset=0</code></p>
      <p className="text-sm text-muted mb-2">
        The <code>status</code> filter is optional. Valid values: <code>open</code>, <code>filled</code>, <code>cancelled</code>.
      </p>
      <CodeBlock language="json">{`{
  "intents": [...],
  "pagination": { "limit": 50, "offset": 0, "count": 5 }
}`}</CodeBlock>

      <hr className="border-border my-8" />

      {/* Policies */}
      <h2 className="text-xl font-semibold mb-4">Policies</h2>

      <h3 className="text-lg font-semibold mb-2">Get Account Policies</h3>
      <p className="text-sm text-muted mb-2"><code>GET /accounts/:address/policies?limit=50&amp;offset=0</code></p>
      <CodeBlock language="json">{`{
  "account": "0x...",
  "policies": [
    {
      "policy_type": "SPEND_LIMIT",
      "token": "0x1111111111111111111111111111111111111111",
      "max_per_day": "10000000000000000000000",
      "block_number": "12"
    },
    {
      "policy_type": "TARGET_ALLOWLIST",
      "target": "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
      "allowed": true,
      "block_number": "13"
    }
  ],
  "pagination": { "limit": 50, "offset": 0, "count": 2 }
}`}</CodeBlock>

      <hr className="border-border my-8" />

      {/* Tx Explain */}
      <h2 className="text-xl font-semibold mb-4">Transaction Explain</h2>

      <h3 className="text-lg font-semibold mb-2">Explain Transaction</h3>
      <p className="text-sm text-muted mb-2"><code>GET /tx/:hash/explain</code></p>
      <CodeBlock language="json">{`{
  "tx_hash": "0x...",
  "block_number": "15",
  "summary": "Transaction contained 1 event(s)",
  "events": [
    {
      "eventName": "IntentSubmitted",
      "args": { "intentId": "1", "owner": "0x...", "nonce": "42" },
      "description": "Intent #1 submitted by 0x..."
    }
  ]
}`}</CodeBlock>

      <hr className="border-border my-8" />

      {/* Common params */}
      <h2 className="text-xl font-semibold mb-4">Common Parameters</h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-muted"><th className="pb-3 pr-4">Parameter</th><th className="pb-3 pr-4">Default</th><th className="pb-3 pr-4">Max</th><th className="pb-3">Description</th></tr></thead>
          <tbody className="divide-y divide-border">
            <tr><td className="py-2 pr-4 font-mono text-xs">limit</td><td className="py-2 pr-4">50</td><td className="py-2 pr-4">100</td><td className="py-2 text-muted">Results per page</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">offset</td><td className="py-2 pr-4">0</td><td className="py-2 pr-4">&mdash;</td><td className="py-2 text-muted">Results to skip</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold mb-4">Notes</h2>
      <ul className="list-disc list-inside space-y-2 text-sm text-muted">
        <li>All addresses are normalized to lowercase.</li>
        <li>NUMERIC/BIGINT values are returned as strings for BigInt safety.</li>
        <li>All error responses follow the format <code>{`{ "error": "message" }`}</code>.</li>
      </ul>
    </div>
  );
}
