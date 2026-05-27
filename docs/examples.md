# Examples

These examples show the common ways to use Cortex on Base Sepolia or a local devnet.

Use the live Base Sepolia API for reads:

```bash
export API_URL=https://api.cortex.wallyweb.com
```

Use your own RPC and contract addresses for writes:

```bash
export RPC_URL=https://sepolia.base.org
export COMMERCE_REGISTRY_ADDRESS=0xf0bf44b28567f0b3d2370dc7af8a63335746d8d4
export SETTLEMENT_ADAPTER_ADDRESS=0xbD61097Cc7b7E1F03E88Fe20E9512ff091126cb3
export AGENT_REGISTRY_ADDRESS=0x24ca7dc7747b0166e73a2d6d99ce677476f046f3
export POLICY_MODULE_ADDRESS=0xb2686c5cc3ab7ce45acfe0091698d9b6a16c2d0c
export INTENT_BOOK_ADDRESS=0x16f7e7c4856bad4dcbe61400630087dab75b229e
```

Never commit private keys. Keep testnet keys in local env files only.

## 1. Add Yourself as a Merchant

Publish a merchant metadata document somewhere stable, such as IPFS, Arweave, or your own HTTPS URL. The metadata should include enough information for agents to evaluate who they are paying.

```json
{
  "name": "Example Data Merchant",
  "website": "https://merchant.example",
  "support": "support@merchant.example",
  "payout_chain": "base-sepolia",
  "refund_policy": "Refunds available when fulfillment hash does not match the accepted quote terms."
}
```

Compute the metadata hash and register the merchant:

```bash
export MERCHANT_KEY=0x...
export PAYOUT_ADDRESS=0x...
export MERCHANT_METADATA_URI=ipfs://merchant-metadata
export MERCHANT_METADATA_HASH=0x...

cast send "$COMMERCE_REGISTRY_ADDRESS" \
  "registerMerchant(address,string,bytes32)" \
  "$PAYOUT_ADDRESS" \
  "$MERCHANT_METADATA_URI" \
  "$MERCHANT_METADATA_HASH" \
  --rpc-url "$RPC_URL" \
  --private-key "$MERCHANT_KEY"
```

After the indexer catches up, find the merchant through the API:

```bash
curl "$API_URL/merchants?owner=$PAYOUT_ADDRESS"
```

If the transaction sender is not the same as the payout address, query by the sender/owner address instead. `payoutAddress` is where settlement can go; `owner` is the wallet authorized to update merchant records and register services.

## 2. Register a Service

A service is a machine-readable product or capability offered by a merchant. Keep rich service details offchain and hash-commit them onchain.

```json
{
  "service_id": "enrich-company-v1",
  "description": "Enrich a company domain with firmographic data.",
  "input_schema": "ipfs://schemas/company-enrichment-input.json",
  "output_schema": "ipfs://schemas/company-enrichment-output.json",
  "payment_rails": ["transfer", "swap", "facilitator", "x402"],
  "sla_seconds": 30,
  "privacy": "Do not include secrets or customer PII in public quote metadata.",
  "refund_terms": "Refund if no valid fulfillment is returned before quote expiry."
}
```

Register the service:

```bash
export MERCHANT_ID=1
export SERVICE_ID=enrich-company-v1
export SERVICE_METADATA_URI=ipfs://service-metadata
export SERVICE_METADATA_HASH=0x...
export CAPABILITY_HASH=0x...

cast send "$COMMERCE_REGISTRY_ADDRESS" \
  "registerService(uint256,string,string,bytes32,bytes32)" \
  "$MERCHANT_ID" \
  "$SERVICE_ID" \
  "$SERVICE_METADATA_URI" \
  "$SERVICE_METADATA_HASH" \
  "$CAPABILITY_HASH" \
  --rpc-url "$RPC_URL" \
  --private-key "$MERCHANT_KEY"
```

Read it back:

```bash
curl "$API_URL/services?merchant_id=$MERCHANT_ID&active=true"
```

## 3. Register an Agent Identity

An agent identity binds an owner wallet to metadata, a public key, and a capabilities hash.

```bash
export AGENT_KEY=0x...
export AGENT_METADATA_URI=ipfs://agent-metadata
export AGENT_PUBKEY=0xaabb
export AGENT_CAPABILITIES_HASH=0x0000000000000000000000000000000000000000000000000000000000000001

cast send "$AGENT_REGISTRY_ADDRESS" \
  "registerAgent(string,bytes,bytes32)" \
  "$AGENT_METADATA_URI" \
  "$AGENT_PUBKEY" \
  "$AGENT_CAPABILITIES_HASH" \
  --rpc-url "$RPC_URL" \
  --private-key "$AGENT_KEY"
```

Read indexed agent state:

```bash
curl "$API_URL/agents/1"
```

## 4. Create a Policy Smart Account for an Agent

The current repo uses `PolicyAccount` as a policy-gated smart account. In local development and demos, it is deployed directly with the agent signer and the shared `PolicyModule` address.

For a production app, wrap this in your account factory, bundler, and wallet UX. The key idea is the same: the account checks `PolicyModule` before execution.

Viem deployment shape:

```ts
const policyAccountHash = await walletClient.deployContract({
  abi: PolicyAccountABI,
  bytecode: policyAccountBytecode,
  args: [agentOwnerAddress, POLICY_MODULE_ADDRESS],
});

const receipt = await publicClient.waitForTransactionReceipt({
  hash: policyAccountHash,
});

const policyAccount = receipt.contractAddress;
```

Then configure account policy:

```ts
await walletClient.writeContract({
  address: policyAccount,
  abi: PolicyAccountABI,
  functionName: "setSpendLimit",
  args: [USDC_ADDRESS, 100_000_000n], // 100 USDC if token has 6 decimals
});

await walletClient.writeContract({
  address: policyAccount,
  abi: PolicyAccountABI,
  functionName: "setTargetAllowed",
  args: [merchantOrRouterAddress, true],
});
```

For short-lived automation, add a session key:

```ts
await walletClient.writeContract({
  address: policyAccount,
  abi: PolicyAccountABI,
  functionName: "setSessionKey",
  args: [sessionKeyAddress, Math.floor(Date.now() / 1000) + 3600, true],
});
```

## 5. Allow Facilitator or x402 Payments

Signed payment policy lets an account authorize facilitator-mediated or x402-style payments without making every facilitator all-powerful.

```bash
export POLICY_ACCOUNT=0x...
export MERCHANT_OWNER=0x...
export TOKEN=0x...
export FACILITATOR=0x...
export MAX_PER_PAYMENT=1000000
export MAX_PER_DAY=10000000

cast send "$POLICY_MODULE_ADDRESS" \
  "setSignedPaymentPolicy(address,address,address,uint256,uint256,bool)" \
  "$MERCHANT_OWNER" \
  "$TOKEN" \
  "$FACILITATOR" \
  "$MAX_PER_PAYMENT" \
  "$MAX_PER_DAY" \
  true \
  --rpc-url "$RPC_URL" \
  --private-key "$AGENT_KEY"
```

The policy key is `(account, merchant, token, facilitator)`. For x402, the facilitator is the payment facilitator that receives or settles the signed authorization.

## 6. Commit a Quote

The merchant commits quote terms before the agent pays. The quote binds merchant, service, agent, token, facilitator, payment rail, amount, expiry, nonce, resource hash, terms hash, optional x402 payload hash, and protocol fee terms.

For multi-merchant, tax, tip, or fee-aware quotes, `termsHash` should hash a `cortex.settlement-plan.v1` JSON document. That settlement plan names every recipient and amount, then confirms the line total equals the quote amount.

```ts
const settlementPlan = {
  schema: "cortex.settlement-plan.v1",
  quote: {
    merchant_id: "1",
    service_numeric_id: "1",
    token: USDC_ADDRESS,
    gross_amount: "1000000",
  },
  lines: [
    { kind: "merchant", recipient: merchantPayoutAddress, amount: "830000" },
    { kind: "supplier", recipient: partnerMerchantAddress, amount: "100000" },
    { kind: "tax", jurisdiction: "state-or-county", recipient: taxReserveAddress, amount: "40000" },
    { kind: "tip", optional: true, recipient: tipRecipientAddress, amount: "10000" },
    { kind: "shipping", method: "merchant-selected ground", recipient: shippingWallet, amount: "15000" },
    { kind: "handling", recipient: fulfillmentWallet, amount: "5000" },
  ],
  fulfillment: {
    encrypted_payload_uri: "https://api.cortex.wallyweb.com/fulfillment-payloads/0x...",
    encrypted_payload_hash: "0x...",
    encryption: "x25519-xsalsa20-poly1305",
    merchant_key_id: "did:key:z6MkMerchantFulfillmentKey",
    plaintext_not_onchain: true,
  },
  verification: {
    line_total: "1000000",
    matches_quote_amount: true,
  },
};

const canonicalizeJson = (value: unknown): string => JSON.stringify(sortJson(value));
const sortJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)]),
  );
};

const termsHash = keccak256(toBytes(canonicalizeJson(settlementPlan)));
```

For physical goods, the shipping address belongs in the encrypted fulfillment payload, not in public metadata or onchain calldata. The merchant publishes a fulfillment encryption key in merchant metadata, the agent encrypts the buyer address to that key, and the quote binds only the encrypted payload URI/hash.

Browser WebCrypto shape:

```ts
const plaintextFulfillment = {
  schema: "cortex.fulfillment-plaintext.v1",
  merchant_id: "1",
  agent: agentAddress,
  quote_hash: quoteHash,
  recipient: {
    name: "Jane Buyer",
    address: {
      line1: "123 Commerce Ave",
      city: "Columbus",
      region: "OH",
      postal_code: "43215",
      country: "US",
    },
  },
  delivery_instructions: "Leave at front desk.",
};

// In browser flows, import the merchant's published P-256 ECDH public JWK,
// derive an AES-GCM key with an ephemeral keypair, and publish only this envelope.
const encryptedFulfillmentEnvelope = {
  schema: "cortex.encrypted-fulfillment.v1",
  merchant_id: "1",
  agent: agentAddress,
  quote_hash: quoteHash,
  encryption: "webcrypto-ecdh-p256-aes-gcm",
  merchant_key_id: "did:key:z6MkMerchantFulfillmentKey",
  ephemeral_public_key_jwk: ephemeralPublicJwk,
  iv: "base64...",
  ciphertext: "base64...",
  contains: ["shipping_name", "shipping_address", "delivery_instructions"],
  plaintext_schema: "cortex.fulfillment-plaintext.v1",
};

const encryptedPayloadHash = keccak256(toBytes(canonicalizeJson(encryptedFulfillmentEnvelope)));

const publishedPayload = await fetch(`${API_URL}/fulfillment-payloads`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    fulfillment_payload_json: canonicalizeJson(encryptedFulfillmentEnvelope),
    expected_hash: encryptedPayloadHash,
    merchant_id: "1",
    agent: agentAddress,
    quote_hash: quoteHash,
    encryption: "webcrypto-ecdh-p256-aes-gcm",
    merchant_key_id: "did:key:z6MkMerchantFulfillmentKey",
  }),
}).then((response) => response.json());
```

Payment rails:

| Value | Rail |
|-------|------|
| `0` | Transfer |
| `1` | Swap |
| `2` | Facilitator |
| `3` | x402 |

Viem write:

```ts
const quote = {
  merchantId: 1n,
  serviceNumericId: 1n,
  agent: agentAddress,
  token: USDC_ADDRESS,
  facilitator: facilitatorAddress,
  amount: 1_000_000n,
  paymentRail: 3,
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
});
```

Agents should compare the quoted terms against their local request and policy before paying.

## 7. Record a Receipt and Fulfillment

Before recording a receipt for a split payment, execute the settlement plan. Direct one-recipient payments can use wallet-to-wallet native ETH or ERC-20 transfers. Multi-party physical-goods purchases should use the settlement adapter so every settlement line is paid atomically.

```ts
const settlementInstruction = {
  quoteHash,
  settlementPlanHash: termsHash,
  payer: agentAddress,
  token: USDC_ADDRESS,
  grossAmount: 1_000_000n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
  lines: [
    { kind: 0, recipient: merchantPayoutAddress, token: USDC_ADDRESS, amount: 700_000n, metadataHash: keccak256(toBytes("merchant")) },
    { kind: 1, recipient: partnerMerchantAddress, token: USDC_ADDRESS, amount: 180_000n, metadataHash: keccak256(toBytes("supplier")) },
    { kind: 2, recipient: taxReserveAddress, token: USDC_ADDRESS, amount: 70_000n, metadataHash: keccak256(toBytes("tax")) },
    { kind: 4, recipient: shippingWallet, token: USDC_ADDRESS, amount: 30_000n, metadataHash: keccak256(toBytes("shipping")) },
    { kind: 5, recipient: fulfillmentWallet, token: USDC_ADDRESS, amount: 20_000n, metadataHash: keccak256(toBytes("handling")) },
  ],
};

await walletClient.writeContract({
  address: USDC_ADDRESS,
  abi: ERC20ABI,
  functionName: "approve",
  args: [SETTLEMENT_ADAPTER_ADDRESS, settlementInstruction.grossAmount],
});

const settlementTx = await walletClient.writeContract({
  address: SETTLEMENT_ADAPTER_ADDRESS,
  abi: SettlementAdapterABI,
  functionName: "executeSettlement",
  args: [settlementInstruction],
});
```

After payment settlement, the merchant, agent, or facilitator records the receipt. The merchant or facilitator can later attach canonical fulfillment evidence. For physical goods, keep tracking numbers, delivery photos, and address data private; publish hashes and encrypted references.

```ts
const receiptHash = await facilitatorWallet.writeContract({
  address: COMMERCE_REGISTRY_ADDRESS,
  abi: CommerceRegistryABI,
  functionName: "recordReceipt",
  args: [quoteHash, resultHash],
});

const fulfillmentEvidence = {
  schema: "cortex.fulfillment-evidence.v1",
  receipt_id: receiptId.toString(),
  quote_hash: quoteHash,
  payload_hash: encryptedPayloadHash,
  evidence_type: "shipment",
  status: "shipped",
  carrier: "ups",
  tracking_hash: keccak256(toBytes("1Z999AA10123456784")),
  delivery_proof_hash: keccak256(toBytes("carrier accepted package")),
  fulfillment_payload_uri: publishedPayload.uri,
  plaintext_not_onchain: true,
};

const fulfillmentHash = keccak256(toBytes(canonicalizeJson(fulfillmentEvidence)));

await fetch(`${API_URL}/fulfillment-evidence`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    fulfillment_evidence_json: canonicalizeJson(fulfillmentEvidence),
    expected_hash: fulfillmentHash,
    receipt_id: receiptId.toString(),
    quote_hash: quoteHash,
    payload_hash: encryptedPayloadHash,
    evidence_type: "shipment",
  }),
});

await merchantWallet.writeContract({
  address: COMMERCE_REGISTRY_ADDRESS,
  abi: CommerceRegistryABI,
  functionName: "recordFulfillment",
  args: [receiptId, fulfillmentHash],
});
```

Read receipts and reputation:

```bash
curl "$API_URL/receipts?agent=0x..."
curl "$API_URL/merchants/1/reputation"
```

## 8. Submit an Agent Intent with the SDK

Agents can also use the SDK to sign and submit EIP-712 intents, optionally reserving execution metadata through the API before the onchain transaction is indexed.

```ts
import { AgentChainClient } from "@cortex/sdk";

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
```

Then inspect bids or indexed intent state:

```ts
const bids = await client.listBids(result.intentId, "open");
```

```bash
curl "$API_URL/intents/$INTENT_ID"
curl "$API_URL/intents/$INTENT_ID/bids?status=open"
```

## 9. Agent Runtime Checklist

Before an agent pays or signs:

1. Fetch merchant and service state from the API.
2. Verify the service metadata hash against the fetched metadata document.
3. Check trust signals, disputes, and merchant reputation.
4. Confirm the quote hash matches the local payment/resource/terms payload.
5. For x402, verify `x402PayloadHash` against the exact facilitator payment requirement.
6. Run policy preflight for the target call or signed payment policy.
7. Submit payment or intent.
8. Wait for receipt/fulfillment indexing.
9. Record a dispute or trust signal if fulfillment is invalid.

## 10. Run the Full Demo

The repository includes a full local demo that registers participants, configures policies, deploys a policy account, submits an intent, records commerce events, and queries the API.

```bash
make e2e
```

For a testnet run, copy the deployed environment and run the demo with funded test wallets:

```bash
cp ops/.env.testnet ops/.env.deployed
cd ops/demo
npm run build
node dist/run.js
```
