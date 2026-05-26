# Cortex SDK Examples

These examples show how to turn onboarding output into executable TypeScript flows with `viem` and the local Cortex SDK.

## Install and Build

From the repo root:

```bash
cd sdk
npm install
npm run build
```

There is also a dry-run script template:

```bash
cd ops/demo
npm install
npm run sdk:commerce
```

Set `EXECUTE_TX=true` only when the environment variables point at funded test wallets and deployed contracts.

Use the hosted Base Sepolia API for reads:

```bash
export API_URL=https://api.cortex.wallyweb.com
export RPC_URL=https://sepolia.base.org
export COMMERCE_REGISTRY_ADDRESS=0x378c1d1a06e80f7a53809bf4289afcd131a3be87
export POLICY_MODULE_ADDRESS=0x8f14e12177c7baf8d389629210c3c82718205fd1
export INTENT_BOOK_ADDRESS=0xea1db573f299a3f064ffd306b309179ff0542e8c
```

## Client Setup

```ts
import { createPublicClient, createWalletClient, http, keccak256, stringToHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { AgentChainClient, PaymentRail } from "./dist/src/index.js";

const account = privateKeyToAccount(process.env.AGENT_KEY as `0x${string}`);
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

const cortex = new AgentChainClient({
  apiUrl: process.env.API_URL ?? "https://api.cortex.wallyweb.com",
  publicClient,
  walletClient,
  chain: baseSepolia,
  intentBookAddress: process.env.INTENT_BOOK_ADDRESS as `0x${string}`,
  commerceRegistryAddress: process.env.COMMERCE_REGISTRY_ADDRESS as `0x${string}`,
  policyModuleAddress: process.env.POLICY_MODULE_ADDRESS as `0x${string}`,
});
```

## 1. Discover Merchants and Services

```ts
const merchants = await cortex.listMerchants({ active: true, limit: 10 });
const services = await cortex.listServices({ merchant_id: 1n, active: true });
const reputation = await cortex.getMerchantReputation(1n);

console.log({ merchants, services, reputation });
```

## 2. Direct Stablecoin Transfer Flow

Cortex does not force every payment through x402. For a direct transfer, the merchant commits the quote, the agent checks policy, then the wallet or smart account transfers the token.

```ts
import { ERC20ABI, PaymentRail } from "./dist/src/index.js";

const quote = {
  merchantId: 1n,
  serviceNumericId: 1n,
  agent: account.address,
  token: process.env.USDC_ADDRESS as `0x${string}`,
  facilitator: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  amount: 1_000_000n,
  paymentRail: PaymentRail.Transfer,
  expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
  paymentNonce: 1n,
  resourceHash: keccak256(stringToHex("company enrichment for example.com")),
  termsHash: keccak256(stringToHex("one enrichment response")),
  x402PayloadHash: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
};

const quoteHash = await cortex.computeQuoteHash(quote);
await cortex.commitQuote(quote);

await walletClient.writeContract({
  address: quote.token,
  abi: ERC20ABI,
  functionName: "transfer",
  args: [process.env.MERCHANT_PAYOUT_ADDRESS as `0x${string}`, quote.amount],
});

console.log({ quoteHash });
```

## 3. Swap-Before-Pay Flow

For swaps, Cortex should bind merchant and service terms in the quote while the account policy constrains router targets, token spend, and function selectors.

```ts
const swapQuote = {
  ...quote,
  token: process.env.USDC_ADDRESS as `0x${string}`,
  paymentRail: PaymentRail.Swap,
  paymentNonce: 2n,
  termsHash: keccak256(stringToHex("swap into USDC then pay merchant")),
};

const swapQuoteHash = await cortex.computeQuoteHash(swapQuote);
await cortex.commitQuote(swapQuote);

// Execute the swap through an approved router in your PolicyAccount or wallet flow.
// Then transfer the quoted token to the merchant payout address.
console.log({ swapQuoteHash });
```

## 4. Facilitator or x402 Payment Policy

For facilitator-mediated and x402-style payments, policy must be checked before the account signs or releases the payment authorization.

```ts
await cortex.setSignedPaymentPolicy({
  merchant: process.env.MERCHANT_OWNER_ADDRESS as `0x${string}`,
  token: process.env.USDC_ADDRESS as `0x${string}`,
  facilitator: process.env.FACILITATOR_ADDRESS as `0x${string}`,
  maxPerPayment: 1_000_000n,
  maxPerDay: 10_000_000n,
  allowed: true,
});
```

## 5. x402 Quote Binding

The x402 payload hash should be computed from the exact normalized payment requirement the facilitator expects.

```ts
const x402Payload = JSON.stringify({
  scheme: "exact",
  network: "base-sepolia",
  token: process.env.USDC_ADDRESS,
  amount: "1000000",
  resource: "https://merchant.example/api/enrich-company",
});

const x402Quote = {
  ...quote,
  facilitator: process.env.FACILITATOR_ADDRESS as `0x${string}`,
  paymentRail: PaymentRail.X402,
  paymentNonce: 3n,
  x402PayloadHash: keccak256(stringToHex(x402Payload)),
};

const x402QuoteHash = await cortex.computeQuoteHash(x402Quote);
await cortex.commitQuote(x402Quote);

// After signing the facilitator authorization, record the payment hash against policy.
await cortex.recordSignedPayment(
  process.env.MERCHANT_OWNER_ADDRESS as `0x${string}`,
  x402Quote.token,
  x402Quote.facilitator,
  x402Quote.amount,
  x402Quote.x402PayloadHash,
);

console.log({ x402QuoteHash });
```

## 6. Receipt and Fulfillment

After settlement, the facilitator or merchant records a receipt. The merchant can later attach fulfillment evidence.

```ts
const resultHash = keccak256(stringToHex("merchant returned enrichment result"));
const receiptTx = await cortex.recordReceipt(x402QuoteHash, resultHash);

// Replace with the indexed receipt id after the transaction is indexed.
const receiptId = 1n;
const fulfillmentHash = keccak256(stringToHex("fulfillment evidence uri or payload hash"));
await cortex.recordFulfillment(receiptId, fulfillmentHash);

const receipts = await cortex.listReceipts({ agent: account.address, merchant_id: 1n });
console.log({ receiptTx, receipts });
```

## 7. Dispute Flow

Disputes create shared evidence for failed fulfillment or agent refund abuse.

```ts
const reasonHash = keccak256(stringToHex("result did not match accepted quote terms"));
const disputeTx = await cortex.openDispute(receiptId, reasonHash);

// Status: 1 = resolved, 2 = rejected.
const resolutionHash = keccak256(stringToHex("refund issued"));
await cortex.resolveDispute(1n, 1, resolutionHash);

console.log({ disputeTx });
```

## 8. Analytics and Reputation

```ts
const analytics = await cortex.getCommerceAnalytics();
const merchantReputation = await cortex.getMerchantReputation(1n);

console.log({ analytics, merchantReputation });
```

## Practical Notes

- The examples use `keccak256(stringToHex(...))` for simple local hashing. Production services should hash the exact bytes they publish or sign.
- For x402, normalize the payment requirement before hashing it.
- For swaps, policy should approve only the expected router and function selectors.
- For receipts and disputes, use indexed API reads to obtain receipt and dispute ids after transactions settle.

## Script Template Environment

`ops/sdk-examples/commerce-flow.ts` reads these variables:

```bash
export AGENT_KEY=0x...
export MERCHANT_OWNER_ADDRESS=0x...
export MERCHANT_PAYOUT_ADDRESS=0x...
export TOKEN_ADDRESS=0x...
export FACILITATOR_ADDRESS=0x...
export MERCHANT_ID=1
export SERVICE_NUMERIC_ID=1
export PAYMENT_AMOUNT=1000000
export PAYMENT_RAIL=0
export EXECUTE_TX=false
```

