import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "x402 Policy — Cortex Docs",
  description: "How Cortex normalizes x402 payment requirements and binds them to quote policy.",
  alternates: { types: { "text/markdown": "/docs/x402-policy.md" } },
};

export default function X402PolicyPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">x402 Policy Integration</h1>
      <p className="text-muted mb-8">
        x402 payments are policy-sensitive because an agent may sign an authorization that a facilitator settles later.
        Cortex verifies merchant, service, facilitator, amount, replay state, and the quote-bound payment payload hash before signing.
      </p>

      <h2 className="text-xl font-semibold mb-4">Pre-Sign Checks</h2>
      <ul className="space-y-2 text-sm text-muted">
        <li>Merchant and service are registered, active, and hash-matched to the catalog.</li>
        <li>Facilitator, token, network, amount, and daily budget are allowed by policy.</li>
        <li>The normalized x402 payload hash equals the quote&apos;s <code>x402PayloadHash</code>.</li>
        <li>The signed payment hash has not already been recorded.</li>
      </ul>

      <h2 className="text-xl font-semibold mb-4 mt-10">Normalizer</h2>
      <p className="text-sm text-muted mb-3">
        <code>POST /x402/normalize</code> accepts a single payment requirement or an <code>accepts[]</code> container,
        maps common x402 field names into a Cortex envelope, and returns the canonical hash.
      </p>
      <CodeBlock language="json">{`{
  "schema": "cortex.x402-payment-requirement.v1",
  "scheme": "exact",
  "network": "base-sepolia",
  "pay_to": "0x...",
  "asset": "0x...",
  "amount": "1000000",
  "resource": "https://merchant.example/api/report",
  "method": "POST",
  "facilitator_url": "https://facilitator.example",
  "nonce": "quote-001"
}`}</CodeBlock>

      <h2 className="text-xl font-semibold mb-4 mt-10">Agent Flow</h2>
      <ol className="space-y-2 text-sm text-muted">
        <li>Fetch the merchant quote response.</li>
        <li>Extract the payment requirement returned by the x402 endpoint or facilitator.</li>
        <li>Normalize and hash the requirement locally or through the hosted API.</li>
        <li>Compare the returned hash with the quote&apos;s <code>x402PayloadHash</code>.</li>
        <li>Run policy checks, then sign only if both hash and policy pass.</li>
      </ol>

      <h2 className="text-xl font-semibold mb-4 mt-10">Remaining Work</h2>
      <ul className="space-y-2 text-sm text-muted">
        <li>Scheme-specific signature verification for EIP-3009 and Permit2.</li>
        <li>Facilitator settlement reconciliation for receipts.</li>
        <li>Production facilitator domain and settlement address allowlists.</li>
      </ul>
    </div>
  );
}
