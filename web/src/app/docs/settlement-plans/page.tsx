import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "Settlement Plans — Cortex Docs",
  description: "Canonical quote-bound settlement plans for multi-merchant, tax, tip, and fee-aware agent payments.",
  alternates: { types: { "text/markdown": "/docs/settlement-plans.md" } },
};

const PLAN = `{
  "schema": "cortex.settlement-plan.v1",
  "network": "base-sepolia",
  "registry": "0xf0bf44b28567f0b3d2370dc7af8a63335746d8d4",
  "quote": {
    "merchant_id": "1",
    "service_numeric_id": "1",
    "agent": "0x...",
    "token": "0x...",
    "payment_rail": "transfer",
    "gross_amount": "1000000"
  },
  "terms": {
    "summary": "One company enrichment response.",
    "refund_policy": "Refunds available when fulfillment does not match accepted quote terms."
  },
  "fulfillment": {
    "encrypted_payload_uri": "https://api.cortex.wallyweb.com/fulfillment/0x...",
    "encrypted_payload_hash": "0x...",
    "encryption": "x25519-xsalsa20-poly1305",
    "merchant_key_id": "did:key:z6MkMerchantFulfillmentKey",
    "plaintext_not_onchain": true
  },
  "lines": [
    { "kind": "merchant", "recipient": "0x...", "amount": "830000", "basis_points": 8300 },
    { "kind": "supplier", "recipient": "0x...", "amount": "100000", "basis_points": 1000 },
    { "kind": "tax", "jurisdiction": "state-or-county", "recipient": "0x...", "amount": "40000", "basis_points": 400 },
    { "kind": "tip", "optional": true, "recipient": "0x...", "amount": "10000", "basis_points": 100 },
    { "kind": "shipping", "method": "merchant-selected ground", "recipient": "0x...", "amount": "15000", "basis_points": 150 },
    { "kind": "handling", "recipient": "0x...", "amount": "5000", "basis_points": 50 }
  ],
  "verification": {
    "line_total": "1000000",
    "matches_quote_amount": true,
    "hash_algorithm": "keccak256(utf8(canonical_settlement_plan_json))"
  }
}`;

export default function SettlementPlansPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Settlement Plans</h1>
      <p className="text-muted mb-8">
        Settlement plans let a Cortex quote describe multi-merchant splits, tax reserves,
        tips, and fees without forcing every payment rail through one settlement contract.
        The plan is hash-bound into the quote through <code>termsHash</code>.
      </p>

      <h2 className="text-xl font-semibold mb-4">Canonical Plan</h2>
      <CodeBlock language="json">{PLAN}</CodeBlock>

      <h2 className="text-xl font-semibold mb-4 mt-10">How Agents Verify It</h2>
      <ol className="list-decimal pl-5 space-y-2 text-sm text-muted">
        <li>Fetch the merchant quote response.</li>
        <li>Extract the exact <code>settlement_plan</code> JSON.</li>
        <li>Recompute <code>keccak256</code> over the canonical JSON bytes.</li>
        <li>Confirm the hash equals the quote <code>termsHash</code>.</li>
        <li>Confirm the line total equals the quote amount.</li>
        <li>Confirm recipients, tax lines, tips, fees, rail, token, and facilitator are allowed by policy.</li>
      </ol>

      <h2 className="text-xl font-semibold mb-4 mt-10">Line Kinds</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="pb-3 pr-4">Kind</th>
              <th className="pb-3">Use</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[
              ["merchant", "Primary merchant payout."],
              ["supplier", "Partner merchant, supplier, affiliate, or service provider."],
              ["tax", "Tax reserve, verified tax provider, or independently verified government wallet."],
              ["tip", "Optional gratuity."],
              ["shipping", "Shipping, postage, freight, or carrier cost."],
              ["handling", "Packaging, pick/pack, warehouse, or fulfillment labor cost."],
              ["platform_fee", "Marketplace or SaaS platform fee."],
              ["facilitator_fee", "Payment facilitator fee."],
              ["protocol_fee", "Future Cortex protocol fee if enabled."],
              ["escrow", "Funds held until fulfillment, delivery, or dispute resolution."],
            ].map(([kind, use]) => (
              <tr key={kind}>
                <td className="py-2 pr-4 font-mono text-xs">{kind}</td>
                <td className="py-2 text-muted">{use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-muted mt-6">
        Tax lines should be treated conservatively. Cortex should not assume government
        wallets exist; use merchant reserve wallets, verified tax providers, or independently
        validated public-sector wallets.
      </p>

      <h2 className="text-xl font-semibold mb-4 mt-10">Encrypted Shipping Address</h2>
      <p className="text-sm text-muted">
        Shipping names, street addresses, phone numbers, and delivery instructions should not be
        public. Merchants publish a fulfillment encryption key in merchant metadata. Agents encrypt
        the buyer fulfillment payload to that key, store it offchain, and bind only the encrypted
        payload URI/hash into the settlement plan.
      </p>
    </div>
  );
}
