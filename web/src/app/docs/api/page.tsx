import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "REST API — Cortex Docs",
  description: "REST API endpoint reference for the Cortex agentic commerce protocol.",
  alternates: { types: { "text/markdown": "/docs/api.md" } },
};

export default function ApiPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">REST API Reference</h1>
      <div className="mb-10 space-y-2 text-muted">
        <p>Hosted Base Sepolia API: <code>https://api.cortex.wallyweb.com</code></p>
        <p>Local development API: <code>http://localhost:3001</code> (configurable via <code>API_PORT</code>)</p>
      </div>

      {/* Health */}
      <h2 className="text-xl font-semibold mb-3">Health Check</h2>
      <p className="text-sm text-muted mb-2"><code>GET /health</code></p>
      <CodeBlock language="json">{`{ "status": "ok" }`}</CodeBlock>

      <hr className="border-border my-8" />

      {/* Catalogs */}
      <h2 className="text-xl font-semibold mb-4">Catalog Documents</h2>

      <h3 className="text-lg font-semibold mb-2">Publish Catalog JSON</h3>
      <p className="text-sm text-muted mb-2"><code>POST /catalogs</code></p>
      <p className="text-sm text-muted mb-2">
        Canonicalizes catalog JSON and stores the canonical bytes by <code>keccak256</code> hash.
        Use the returned <code> uri</code> and <code>catalog_hash</code> as the service metadata URI/hash.
      </p>
      <CodeBlock language="json">{`{
  "catalog_json": "{\\n  \\"merchant\\": {...},\\n  \\"services\\": [...]\\n}",
  "expected_hash": "0x...",
  "merchant_id": "1",
  "service_id": "enrich-company-v1"
}`}</CodeBlock>
      <CodeBlock language="json">{`{
  "catalog_hash": "0x...",
  "merchant_id": "1",
  "service_id": "enrich-company-v1",
  "size_bytes": 2048,
  "uri": "https://api.cortex.wallyweb.com/catalogs/0x...",
  "canonical_json": "{\\"merchant\\":{},\\"services\\":[]}"
}`}</CodeBlock>

      <h3 className="text-lg font-semibold mb-2">Fetch Catalog JSON</h3>
      <p className="text-sm text-muted mb-2"><code>GET /catalogs/:hash</code></p>
      <p className="text-sm text-muted mb-6">
        Returns canonical JSON text as <code>application/json</code>. Metadata is available at
        <code> GET /catalogs/:hash/metadata</code>.
      </p>

      <hr className="border-border my-8" />

      {/* Quote documents */}
      <h2 className="text-xl font-semibold mb-4">Quote Documents</h2>

      <h3 className="text-lg font-semibold mb-2">Publish Quote Request</h3>
      <p className="text-sm text-muted mb-2"><code>POST /quote-requests</code></p>
      <p className="text-sm text-muted mb-2">
        Canonicalizes the agent quote request JSON by <code>keccak256</code> hash and returns a stable URI.
      </p>
      <CodeBlock language="json">{`{
  "quote_request_json": "{\\n  \\"request_id\\": \\"req-001\\"\\n}",
  "expected_hash": "0x...",
  "request_id": "req-001",
  "merchant_id": "1",
  "service_numeric_id": "1",
  "service_id": "enrich-company-v1",
  "agent": "0x..."
}`}</CodeBlock>

      <h3 className="text-lg font-semibold mb-2">Publish Quote Response</h3>
      <p className="text-sm text-muted mb-2"><code>POST /quote-responses</code></p>
      <p className="text-sm text-muted mb-2">
        Canonicalizes the merchant quote response JSON and can link it to a hosted quote request hash.
      </p>
      <CodeBlock language="json">{`{
  "quote_response_json": "{\\n  \\"request_id\\": \\"req-001\\",\\n  \\"quote\\": {...}\\n}",
  "expected_hash": "0x...",
  "request_hash": "0x...",
  "request_id": "req-001",
  "merchant_id": "1",
  "service_numeric_id": "1",
  "agent": "0x..."
}`}</CodeBlock>
      <p className="text-sm text-muted mb-6">
        Fetch canonical JSON at <code>GET /quote-requests/:hash</code> and <code>GET /quote-responses/:hash</code>.
        Metadata is available at each route&apos;s <code>/metadata</code> path.
      </p>

      <h3 className="text-lg font-semibold mb-2">Normalize x402 Payment Requirement</h3>
      <p className="text-sm text-muted mb-2"><code>POST /x402/normalize</code></p>
      <p className="text-sm text-muted mb-2">
        Normalizes a facilitator payment requirement into the Cortex canonical x402 shape, hashes it,
        and can compare the result against a quote&apos;s <code>x402PayloadHash</code>.
      </p>
      <CodeBlock language="json">{`{
  "payment_requirement_json": {
    "accepts": [{
      "scheme": "exact",
      "network": "base-sepolia",
      "payTo": "0x...",
      "asset": "0x...",
      "maxAmountRequired": "1000000",
      "resource": "https://merchant.example/api/report",
      "method": "POST",
      "facilitator": { "url": "https://facilitator.example" },
      "nonce": "quote-001"
    }]
  },
  "expected_hash": "0x...",
  "quote": { "x402_payload_hash": "0x..." }
}`}</CodeBlock>
      <CodeBlock language="json">{`{
  "normalized": {
    "schema": "cortex.x402-payment-requirement.v1",
    "scheme": "exact",
    "network": "base-sepolia",
    "pay_to": "0x...",
    "asset": "0x...",
    "amount": "1000000"
  },
  "canonical_json": "{\\"amount\\":\\"1000000\\",\\"asset\\":\\"0x...\\"}",
  "x402_payload_hash": "0x...",
  "matches_expected_hash": true,
  "matches_quote_hash": true,
  "warnings": []
}`}</CodeBlock>
      <p className="text-sm text-muted mb-6">
        Agents should sign only after the normalized hash matches the quote-bound hash and policy checks pass.
      </p>

      <h3 className="text-lg font-semibold mb-2">Publish Encrypted Fulfillment Payload</h3>
      <p className="text-sm text-muted mb-2"><code>POST /fulfillment-payloads</code></p>
      <p className="text-sm text-muted mb-2">
        Stores canonical encrypted fulfillment payload envelopes by hash. Payloads should contain
        ciphertext and encryption metadata, not plaintext shipping data.
      </p>
      <CodeBlock language="json">{`{
  "fulfillment_payload_json": "{\\n  \\"schema\\": \\"cortex.encrypted-fulfillment.v1\\",\\n  \\"ciphertext\\": \\"base64:...\\"\\n}",
  "expected_hash": "0x...",
  "merchant_id": "1",
  "agent": "0x...",
  "quote_hash": "0x...",
  "encryption": "x25519-xsalsa20-poly1305",
  "merchant_key_id": "did:key:z6MkMerchantFulfillmentKey"
}`}</CodeBlock>
      <p className="text-sm text-muted mb-6">
        Fetch canonical envelope JSON at <code>GET /fulfillment-payloads/:hash</code>. Metadata is
        available at <code>GET /fulfillment-payloads/:hash/metadata</code>.
      </p>

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

      {/* Commerce */}
      <h2 className="text-xl font-semibold mb-4">Commerce</h2>
      <div className="grid gap-3 text-sm text-muted mb-6">
        <p><code>GET /merchants?owner=0x...&amp;active=true</code> — list registered merchants.</p>
        <p><code>GET /merchants/:id</code> — get one merchant.</p>
        <p><code>GET /services?merchant_id=1&amp;capability_hash=0x...&amp;active=true</code> — list services.</p>
        <p><code>GET /services/:id</code> — get one service.</p>
        <p><code>GET /facilitators?active=true</code> — list payment facilitators.</p>
        <p><code>GET /quotes/:quoteHash</code> — get a canonical quote commitment.</p>
        <p><code>GET /receipts?agent=0x...&amp;merchant_id=1</code> — list settled receipts.</p>
        <p><code>GET /disputes?receipt_id=1</code> — list receipt-linked disputes.</p>
        <p><code>GET /trust-signals?subject_type=0&amp;subject_id=1</code> — list trust and risk signals.</p>
        <p><code>GET /merchants/:id/reputation</code> — get receipt, fulfillment, dispute, and trust summaries.</p>
      </div>
      <CodeBlock language="json">{`{
  "quote_hash": "0x...",
  "merchant_id": "1",
  "service_numeric_id": "1",
  "agent": "0x...",
  "token": "0x...",
  "facilitator": "0x...",
  "amount": "1000000000000000000",
  "payment_rail": 3,
  "protocol_fee_bps": 0,
  "protocol_fee_amount": "0",
  "payment_nonce": "1",
  "resource_hash": "0x...",
  "terms_hash": "0x...",
  "x402_payload_hash": "0x...",
  "settled": true
}`}</CodeBlock>
      <p className="text-sm text-muted mt-3 mb-6">
        Cortex supports basic wallet transfers, swaps, facilitator-mediated payments, and x402.
        The x402 payload hash is used only when the selected payment rail is x402.
      </p>

      <h2 className="text-xl font-semibold mb-4">Commerce Analytics</h2>
      <p className="text-sm text-muted mb-2"><code>GET /analytics/commerce</code></p>
      <CodeBlock language="json">{`{
  "summary": {
    "merchants": "1",
    "services": "1",
    "quotes": "1",
    "receipts": "1",
    "settled_volume": "1000000000000000000",
    "settled_protocol_fees": "0",
    "open_disputes": "0"
  },
  "volume_by_token": [],
  "top_merchants": [],
  "top_services": [],
  "facilitator_volume": [],
  "volume_by_payment_rail": [],
  "trust_signals_by_kind": []
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
