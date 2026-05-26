import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "Examples — Cortex Docs",
  description: "Practical examples for merchants, agents, smart accounts, quotes, receipts, and SDK usage.",
  alternates: { types: { "text/markdown": "/docs/examples.md" } },
};

const LIVE_ADDRESSES = [
  ["CommerceRegistry", "0xf0bf44b28567f0b3d2370dc7af8a63335746d8d4"],
  ["AgentRegistry", "0x24ca7dc7747b0166e73a2d6d99ce677476f046f3"],
  ["PolicyModule", "0xb2686c5cc3ab7ce45acfe0091698d9b6a16c2d0c"],
  ["IntentBook", "0x16f7e7c4856bad4dcbE61400630087Dab75B229E"],
];

export default function ExamplesPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Examples</h1>
      <p className="text-muted mb-8">
        Practical flows for using Cortex as a merchant, agent operator, or application developer.
        Reads can use the hosted Base Sepolia API; writes go through your wallet, RPC, and the deployed contracts.
      </p>

      <h2 className="text-xl font-semibold mb-4">Base Sepolia Setup</h2>
      <CodeBlock language="bash">{`export API_URL=https://api.cortex.wallyweb.com
export RPC_URL=https://sepolia.base.org
export COMMERCE_REGISTRY_ADDRESS=0xf0bf44b28567f0b3d2370dc7af8a63335746d8d4
export AGENT_REGISTRY_ADDRESS=0x24ca7dc7747b0166e73a2d6d99ce677476f046f3
export POLICY_MODULE_ADDRESS=0xb2686c5cc3ab7ce45acfe0091698d9b6a16c2d0c
export INTENT_BOOK_ADDRESS=0x16f7e7c4856bad4dcbE61400630087Dab75B229E`}</CodeBlock>

      <div className="overflow-x-auto my-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="pb-3 pr-4">Contract</th>
              <th className="pb-3">Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {LIVE_ADDRESSES.map(([name, address]) => (
              <tr key={name}>
                <td className="py-2 pr-4 font-medium">{name}</td>
                <td className="py-2 font-mono text-xs">{address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold mb-4">Add Yourself as a Merchant</h2>
      <p className="text-sm text-muted mb-3">
        Publish merchant metadata offchain, hash it, then anchor the merchant record onchain.
      </p>
      <CodeBlock language="json">{`{
  "name": "Example Data Merchant",
  "website": "https://merchant.example",
  "support": "support@merchant.example",
  "payout_chain": "base-sepolia",
  "refund_policy": "Refunds available when fulfillment does not match accepted quote terms."
}`}</CodeBlock>
      <CodeBlock language="bash">{`export MERCHANT_KEY=0x...
export PAYOUT_ADDRESS=0x...
export MERCHANT_METADATA_URI=ipfs://merchant-metadata
export MERCHANT_METADATA_HASH=0x...

cast send "$COMMERCE_REGISTRY_ADDRESS" \\
  "registerMerchant(address,string,bytes32)" \\
  "$PAYOUT_ADDRESS" \\
  "$MERCHANT_METADATA_URI" \\
  "$MERCHANT_METADATA_HASH" \\
  --rpc-url "$RPC_URL" \\
  --private-key "$MERCHANT_KEY"

curl "$API_URL/merchants?owner=0x..."`}</CodeBlock>

      <h2 className="text-xl font-semibold mb-4 mt-10">Register a Service</h2>
      <p className="text-sm text-muted mb-3">
        A service is a merchant-owned capability with a metadata URI/hash and capability hash.
      </p>
      <CodeBlock language="bash">{`export MERCHANT_ID=1
export SERVICE_ID=enrich-company-v1
export SERVICE_METADATA_URI=ipfs://service-metadata
export SERVICE_METADATA_HASH=0x...
export CAPABILITY_HASH=0x...

cast send "$COMMERCE_REGISTRY_ADDRESS" \\
  "registerService(uint256,string,string,bytes32,bytes32)" \\
  "$MERCHANT_ID" \\
  "$SERVICE_ID" \\
  "$SERVICE_METADATA_URI" \\
  "$SERVICE_METADATA_HASH" \\
  "$CAPABILITY_HASH" \\
  --rpc-url "$RPC_URL" \\
  --private-key "$MERCHANT_KEY"

curl "$API_URL/services?merchant_id=$MERCHANT_ID&active=true"`}</CodeBlock>

      <h2 className="text-xl font-semibold mb-4 mt-10">Register an Agent</h2>
      <CodeBlock language="bash">{`export AGENT_KEY=0x...
export AGENT_METADATA_URI=ipfs://agent-metadata
export AGENT_PUBKEY=0xaabb
export AGENT_CAPABILITIES_HASH=0x0000000000000000000000000000000000000000000000000000000000000001

cast send "$AGENT_REGISTRY_ADDRESS" \\
  "registerAgent(string,bytes,bytes32)" \\
  "$AGENT_METADATA_URI" \\
  "$AGENT_PUBKEY" \\
  "$AGENT_CAPABILITIES_HASH" \\
  --rpc-url "$RPC_URL" \\
  --private-key "$AGENT_KEY"

curl "$API_URL/agents/1"`}</CodeBlock>

      <h2 className="text-xl font-semibold mb-4 mt-10">Create a Policy Smart Account</h2>
      <p className="text-sm text-muted mb-3">
        In the current repo, <code>PolicyAccount</code> is deployed with an agent signer and the shared policy module.
        A production app should wrap this in its account factory, bundler, and wallet UX.
      </p>
      <CodeBlock language="ts">{`const policyAccountHash = await walletClient.deployContract({
  abi: PolicyAccountABI,
  bytecode: policyAccountBytecode,
  args: [agentOwnerAddress, POLICY_MODULE_ADDRESS],
});

const receipt = await publicClient.waitForTransactionReceipt({ hash: policyAccountHash });
const policyAccount = receipt.contractAddress;

await walletClient.writeContract({
  address: policyAccount,
  abi: PolicyAccountABI,
  functionName: "setSpendLimit",
  args: [USDC_ADDRESS, 100_000_000n],
});

await walletClient.writeContract({
  address: policyAccount,
  abi: PolicyAccountABI,
  functionName: "setTargetAllowed",
  args: [merchantOrRouterAddress, true],
});`}</CodeBlock>

      <h2 className="text-xl font-semibold mb-4 mt-10">Allow Facilitator or x402 Payments</h2>
      <CodeBlock language="bash">{`export MERCHANT_OWNER=0x...
export TOKEN=0x...
export FACILITATOR=0x...
export MAX_PER_PAYMENT=1000000
export MAX_PER_DAY=10000000

cast send "$POLICY_MODULE_ADDRESS" \\
  "setSignedPaymentPolicy(address,address,address,uint256,uint256,bool)" \\
  "$MERCHANT_OWNER" \\
  "$TOKEN" \\
  "$FACILITATOR" \\
  "$MAX_PER_PAYMENT" \\
  "$MAX_PER_DAY" \\
  true \\
  --rpc-url "$RPC_URL" \\
  --private-key "$AGENT_KEY"`}</CodeBlock>

      <h2 className="text-xl font-semibold mb-4 mt-10">Commit a Quote</h2>
      <p className="text-sm text-muted mb-3">
        Quotes bind payment rail, amount, expiry, nonce, resource hash, terms hash, optional x402 payload hash,
        and zero-fee protocol instrumentation.
      </p>
      <CodeBlock language="ts">{`const quote = {
  merchantId: 1n,
  serviceNumericId: 1n,
  agent: agentAddress,
  token: USDC_ADDRESS,
  facilitator: facilitatorAddress,
  amount: 1_000_000n,
  paymentRail: 3, // 0=transfer, 1=swap, 2=facilitator, 3=x402
  expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
  paymentNonce: 1n,
  resourceHash,
  termsHash,
  x402PayloadHash,
};

const quoteHash = await publicClient.readContract({
  address: COMMERCE_REGISTRY_ADDRESS,
  abi: CommerceRegistryABI,
  functionName: "computeQuoteHash",
  args: [
    quote.merchantId,
    quote.serviceNumericId,
    quote.agent,
    quote.token,
    quote.facilitator,
    quote.amount,
    quote.paymentRail,
    quote.expiresAt,
    quote.paymentNonce,
    quote.resourceHash,
    quote.termsHash,
    quote.x402PayloadHash,
  ],
});

await walletClient.writeContract({
  address: COMMERCE_REGISTRY_ADDRESS,
  abi: CommerceRegistryABI,
  functionName: "commitQuote",
  args: [quote],
});`}</CodeBlock>

      <h2 className="text-xl font-semibold mb-4 mt-10">Record a Receipt and Fulfillment</h2>
      <CodeBlock language="ts">{`await facilitatorWallet.writeContract({
  address: COMMERCE_REGISTRY_ADDRESS,
  abi: CommerceRegistryABI,
  functionName: "recordReceipt",
  args: [quoteHash, resultHash],
});

await merchantWallet.writeContract({
  address: COMMERCE_REGISTRY_ADDRESS,
  abi: CommerceRegistryABI,
  functionName: "recordFulfillment",
  args: [receiptId, fulfillmentHash],
});`}</CodeBlock>
      <CodeBlock language="bash">{`curl "$API_URL/receipts?agent=0x..."
curl "$API_URL/merchants/1/reputation"`}</CodeBlock>

      <h2 className="text-xl font-semibold mb-4 mt-10">Submit an Agent Intent with the SDK</h2>
      <CodeBlock language="ts">{`import { AgentChainClient } from "@cortex/sdk";

const client = new AgentChainClient({
  apiUrl: "https://api.cortex.wallyweb.com",
  publicClient,
  walletClient,
  intentBookAddress: INTENT_BOOK_ADDRESS,
  chain: { id: 84532 },
});

const result = await client.createIntent({
  intent: {
    inputToken: USDC_ADDRESS,
    outputToken: OUTPUT_TOKEN,
    nonce: BigInt(Date.now()),
    constraints: {
      amountInMax: 1_000_000n,
      amountOutMin: 990_000n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 1800),
      slippageBps: 100,
    },
  },
  metadata: {
    metadata_uri: "ipfs://intent-metadata",
    execution_target: routerAddress,
    execution_data: "0x...",
  },
  preflight: {
    account: policyAccountAddress,
    target: routerAddress,
    value: "0",
    data: "0x...",
  },
});

const bids = await client.listBids(result.intentId, "open");`}</CodeBlock>

      <h2 className="text-xl font-semibold mb-4 mt-10">Agent Runtime Checklist</h2>
      <ol className="list-decimal list-inside space-y-2 text-sm text-muted">
        <li>Fetch merchant and service state from the API.</li>
        <li>Verify service metadata hashes against fetched metadata documents.</li>
        <li>Check trust signals, disputes, and merchant reputation.</li>
        <li>Confirm quote hash matches local payment/resource/terms payloads.</li>
        <li>For x402, verify <code>x402PayloadHash</code> against the facilitator payment requirement.</li>
        <li>Run policy preflight for target calls or signed payment policy.</li>
        <li>Submit payment or intent.</li>
        <li>Wait for receipt and fulfillment indexing.</li>
        <li>Record a dispute or trust signal if fulfillment is invalid.</li>
      </ol>

      <h2 className="text-xl font-semibold mb-4 mt-10">Run the Full Demo</h2>
      <CodeBlock language="bash">{`make e2e

# Testnet demo with funded wallets
cp ops/.env.testnet ops/.env.deployed
cd ops/demo
npm run build
node dist/run.js`}</CodeBlock>
    </div>
  );
}
