import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "Settlement Adapter — Cortex Docs",
  description: "Design for direct native and ERC-20 split settlement adapters for Cortex quote-bound settlement plans.",
  alternates: { types: { "text/markdown": "/docs/settlement-adapter.md" } },
};

export default function SettlementAdapterPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Settlement Adapter</h1>
      <p className="text-muted mb-8">
        The first adapter turns a verified settlement plan into direct native-token or ERC-20
        split execution. It uses deterministic line data derived from the canonical JSON plan
        and keeps encrypted fulfillment payloads offchain.
      </p>

      <h2 className="text-xl font-semibold mb-4">Target Interface</h2>
      <CodeBlock language="solidity">{`function executeSettlement(SettlementInstruction calldata instruction)
    external
    payable
    returns (bytes32 executionHash);`}</CodeBlock>

      <h2 className="text-xl font-semibold mb-4 mt-10">Version One Scope</h2>
      <ul className="space-y-2 text-sm text-muted">
        <li>Native-token split when token is address(0).</li>
        <li>ERC-20 split when token is not address(0).</li>
        <li>One token per execution.</li>
        <li>Line-total validation against gross amount.</li>
        <li>Merchant, supplier, tax, tip, shipping, handling, fee, and escrow line kinds.</li>
      </ul>

      <h2 className="text-xl font-semibold mb-4 mt-10">Deferred</h2>
      <ul className="space-y-2 text-sm text-muted">
        <li>DEX routing and cross-token settlement.</li>
        <li>Tax calculation.</li>
        <li>Address decryption.</li>
        <li>x402 facilitator reconciliation.</li>
        <li>Refund arbitration.</li>
      </ul>
    </div>
  );
}
