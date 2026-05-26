import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "SDK Examples — Cortex Docs",
  description: "TypeScript SDK examples for Cortex merchant discovery, quote commitments, payments, receipts, and disputes.",
  alternates: { types: { "text/markdown": "/docs/sdk-examples.md" } },
};

const SETUP = `export API_URL=https://api.cortex.wallyweb.com
export RPC_URL=https://sepolia.base.org
export COMMERCE_REGISTRY_ADDRESS=0xf0bf44b28567f0b3d2370dc7af8a63335746d8d4
export POLICY_MODULE_ADDRESS=0xb2686c5cc3ab7ce45acfe0091698d9b6a16c2d0c
export INTENT_BOOK_ADDRESS=0x16f7e7c4856bad4dcbE61400630087Dab75B229E`;

const CLIENT = `const cortex = new AgentChainClient({
  apiUrl: process.env.API_URL ?? "https://api.cortex.wallyweb.com",
  publicClient,
  walletClient,
  chain: baseSepolia,
  intentBookAddress: process.env.INTENT_BOOK_ADDRESS as \`0x\${string}\`,
  commerceRegistryAddress: process.env.COMMERCE_REGISTRY_ADDRESS as \`0x\${string}\`,
  policyModuleAddress: process.env.POLICY_MODULE_ADDRESS as \`0x\${string}\`,
});`;

const QUOTE = `const quoteHash = await cortex.computeQuoteHash(quote);
await cortex.commitQuote(quote);

await walletClient.writeContract({
  address: quote.token,
  abi: ERC20ABI,
  functionName: "transfer",
  args: [merchantPayoutAddress, quote.amount],
});`;

const X402 = `await cortex.setSignedPaymentPolicy({
  merchant: merchantOwnerAddress,
  token: usdcAddress,
  facilitator: facilitatorAddress,
  maxPerPayment: 1_000_000n,
  maxPerDay: 10_000_000n,
  allowed: true,
});

const x402PayloadHash = keccak256(stringToHex(normalizedX402Payload));
await cortex.recordSignedPayment(
  merchantOwnerAddress,
  usdcAddress,
  facilitatorAddress,
  1_000_000n,
  x402PayloadHash,
);`;

const RECEIPTS = `const receiptTx = await cortex.recordReceipt(quoteHash, resultHash);
const receipts = await cortex.listReceipts({ agent: account.address, merchant_id: 1n });

const disputeTx = await cortex.openDispute(receiptId, reasonHash);
await cortex.resolveDispute(disputeId, 1, resolutionHash);`;

export default function SdkExamplesPage() {
  return (
    <div>
      <h1 className="mb-4 text-3xl font-bold">SDK Examples</h1>
      <p className="mb-8 max-w-3xl text-muted">
        Copy-paste TypeScript flows for turning onboarding output into executable commerce:
        discovery, direct payments, swap-before-pay, facilitator/x402 policy, receipts, disputes,
        analytics, and reputation.
      </p>

      <h2 className="mb-4 text-xl font-semibold">Environment</h2>
      <CodeBlock language="bash">{SETUP}</CodeBlock>

      <div className="my-6 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-base font-semibold">Runnable dry-run template</h2>
        <p className="mt-2 text-sm text-muted">
          Use <code>ops/sdk-examples/commerce-flow.ts</code> through the demo package to test the
          SDK flow without sending transactions by default.
        </p>
        <CodeBlock language="bash">{`cd ops/demo
npm install
npm run sdk:commerce
npm run sdk:payment-rails`}</CodeBlock>
      </div>

      <div className="my-6 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-base font-semibold">Hosted payment rail dry run</h2>
        <p className="mt-2 text-sm text-muted">
          <code>ops/sdk-examples/payment-rails.ts</code> consumes hosted catalog and quote URLs,
          verifies their hashes, computes the quote hash, checks reputation, and prints a rail-specific
          execution plan before any transaction is sent.
        </p>
        <CodeBlock language="bash">{`export CATALOG_URL=https://api.cortex.wallyweb.com/catalogs/0x...
export QUOTE_REQUEST_URL=https://api.cortex.wallyweb.com/quote-requests/0x...
export QUOTE_RESPONSE_URL=https://api.cortex.wallyweb.com/quote-responses/0x...
npm run sdk:payment-rails`}</CodeBlock>
        <p className="mt-3 text-sm text-muted">
          Current Base Sepolia contract semantics are rail-aware: facilitator and x402 quotes require an
          active facilitator, while transfer and swap quotes can use <code>address(0)</code> and allow
          the merchant or agent to record the receipt.
        </p>
      </div>

      <h2 className="mb-4 mt-10 text-xl font-semibold">Client Setup</h2>
      <CodeBlock language="ts">{CLIENT}</CodeBlock>

      <h2 className="mb-4 mt-10 text-xl font-semibold">Quote and Direct Transfer</h2>
      <p className="mb-3 text-sm text-muted">
        Compute the quote hash, commit it onchain, then pay through a normal ERC-20 transfer.
      </p>
      <CodeBlock language="ts">{QUOTE}</CodeBlock>

      <h2 className="mb-4 mt-10 text-xl font-semibold">Facilitator and x402 Policy</h2>
      <p className="mb-3 text-sm text-muted">
        Configure signed payment budgets and record the exact x402 payload hash against policy.
      </p>
      <CodeBlock language="ts">{X402}</CodeBlock>

      <h2 className="mb-4 mt-10 text-xl font-semibold">Receipts and Disputes</h2>
      <CodeBlock language="ts">{RECEIPTS}</CodeBlock>

      <div className="mt-8 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-base font-semibold">Full Examples</h2>
        <p className="mt-2 text-sm text-muted">
          The full markdown includes direct stablecoin transfer, swap-before-pay, x402 quote
          binding, receipt/fulfillment, dispute, analytics, and reputation examples.
        </p>
        <a href="/docs/sdk-examples.md" className="mt-4 inline-flex text-sm font-medium text-accent hover:underline">
          View full markdown
        </a>
      </div>
    </div>
  );
}
