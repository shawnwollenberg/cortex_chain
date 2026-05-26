import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  stringToHex,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { AgentChainClient, ERC20ABI, PaymentRail, type QuoteCommitment } from "../../sdk/src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv(resolve(__dirname, "..", ".env.testnet"));
loadEnv(resolve(__dirname, "..", "..", "contracts", ".env"));

const API_URL = process.env.API_URL ?? "https://api.cortex.wallyweb.com";
const RPC_URL = process.env.RPC_URL ?? "https://sepolia.base.org";
const EXECUTE_TX = process.env.EXECUTE_TX === "true";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const agent = privateKeyToAccount(requiredHex("AGENT_KEY"));
const merchant = process.env.MERCHANT_KEY ? privateKeyToAccount(requiredHex("MERCHANT_KEY")) : null;
const facilitatorAccount = process.env.FACILITATOR_KEY ? privateKeyToAccount(requiredHex("FACILITATOR_KEY")) : null;

const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
const agentWallet = createWalletClient({ account: agent, chain: baseSepolia, transport: http(RPC_URL) });
const merchantWallet = merchant ? createWalletClient({ account: merchant, chain: baseSepolia, transport: http(RPC_URL) }) : null;
const facilitatorWallet = facilitatorAccount
  ? createWalletClient({ account: facilitatorAccount, chain: baseSepolia, transport: http(RPC_URL) })
  : null;

const baseConfig = {
  apiUrl: API_URL,
  publicClient,
  chain: baseSepolia,
  intentBookAddress: requiredAddress("INTENT_BOOK_ADDRESS"),
  commerceRegistryAddress: requiredAddress("COMMERCE_REGISTRY_ADDRESS"),
  policyModuleAddress: requiredAddress("POLICY_MODULE_ADDRESS"),
};

const agentCortex = new AgentChainClient({ ...baseConfig, walletClient: agentWallet });
const merchantCortex = merchantWallet ? new AgentChainClient({ ...baseConfig, walletClient: merchantWallet }) : null;
const facilitatorCortex = facilitatorWallet ? new AgentChainClient({ ...baseConfig, walletClient: facilitatorWallet }) : null;

async function main() {
  console.log("Cortex payment rail dry-run");
  console.log(`API: ${API_URL}`);
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Agent: ${agent.address}`);
  console.log(`Execute transactions: ${EXECUTE_TX}`);

  const catalog = await fetchHostedDocument("CATALOG_URL", "CATALOG_HASH");
  const quoteRequest = await fetchHostedDocument("QUOTE_REQUEST_URL", "QUOTE_REQUEST_HASH");
  const quoteResponse = await fetchHostedDocument("QUOTE_RESPONSE_URL", "QUOTE_RESPONSE_HASH");

  printDocumentSummary("catalog", catalog);
  printDocumentSummary("quote request", quoteRequest);
  printDocumentSummary("quote response", quoteResponse);

  const quote = quoteFromResponse(quoteResponse?.json) ?? quoteFromEnv();
  const quoteHash = await agentCortex.computeQuoteHash(quote);
  const selectedRail = Number(process.env.PAYMENT_RAIL ?? quote.paymentRail) as PaymentRail;
  const plan = buildPlan(selectedRail, quote, quoteHash);

  console.log("\nExecution plan");
  for (const [index, step] of plan.entries()) {
    console.log(`${index + 1}. ${step}`);
  }

  const merchantReputation = await agentCortex.getMerchantReputation(quote.merchantId).catch((error: Error) => ({
    warning: error.message,
  }));
  console.log("\nMerchant reputation");
  console.log(JSON.stringify(merchantReputation, null, 2));

  if (!EXECUTE_TX) {
    console.log("\nDry run complete. Set EXECUTE_TX=true only after checking keys, balances, policy, and quote parties.");
    return;
  }

  await executeRail(selectedRail, quote, quoteHash);
}

async function executeRail(rail: PaymentRail, quote: QuoteCommitment, quoteHash: Hex) {
  if (merchantCortex) {
    const tx = await merchantCortex.commitQuote(quote);
    console.log(`Quote committed: ${tx}`);
  } else {
    console.log("Skipped quote commit: MERCHANT_KEY is not set.");
  }

  if (rail === PaymentRail.Transfer) {
    const payout = requiredAddress("MERCHANT_PAYOUT_ADDRESS");
    const transferTx = await agentWallet.writeContract({
      account: agent,
      chain: baseSepolia,
      address: quote.token,
      abi: ERC20ABI,
      functionName: "transfer",
      args: [payout, quote.amount],
    });
    console.log(`ERC20 transfer: ${transferTx}`);
  }

  if (rail === PaymentRail.Swap) {
    const router = optionalAddress("SWAP_ROUTER_ADDRESS");
    const data = optionalHex("SWAP_CALLDATA");
    if (!router || !data) {
      console.log("Skipped swap execution: SWAP_ROUTER_ADDRESS and SWAP_CALLDATA are required.");
    } else {
      const swapTx = await agentWallet.sendTransaction({
        account: agent,
        chain: undefined,
        to: router,
        data,
        value: BigInt(process.env.SWAP_ETH_VALUE ?? "0"),
        kzg: undefined,
      });
      console.log(`Swap/router tx: ${swapTx}`);
    }
  }

  if (rail === PaymentRail.Facilitator || rail === PaymentRail.X402) {
    const merchantOwner = requiredAddress("MERCHANT_OWNER_ADDRESS");
    const policyTx = await agentCortex.setSignedPaymentPolicy({
      merchant: merchantOwner,
      token: quote.token,
      facilitator: quote.facilitator,
      maxPerPayment: quote.amount,
      maxPerDay: BigInt(process.env.MAX_PER_DAY ?? (quote.amount * 10n).toString()),
      allowed: true,
    });
    console.log(`Signed payment policy: ${policyTx}`);

    const paymentHash = rail === PaymentRail.X402 ? quote.x402PayloadHash : quoteHash;
    const recordTx = await agentCortex.recordSignedPayment(
      merchantOwner,
      quote.token,
      quote.facilitator,
      quote.amount,
      paymentHash,
    );
    console.log(`Signed payment recorded: ${recordTx}`);
  }

  if (facilitatorCortex) {
    const resultHash = keccak256(stringToHex(process.env.RESULT_DESCRIPTOR ?? "payment rail sample result"));
    const receiptTx = await facilitatorCortex.recordReceipt(quoteHash, resultHash);
    console.log(`Receipt recorded: ${receiptTx}`);
  } else {
    console.log("Skipped receipt recording: FACILITATOR_KEY is not set.");
  }
}

function buildPlan(rail: PaymentRail, quote: QuoteCommitment, quoteHash: Hex) {
  const steps = [
    `Verify hosted catalog, quote request, and quote response hashes.`,
    `Read merchant #${quote.merchantId} reputation and service #${quote.serviceNumericId}.`,
    `Compute onchain quote hash ${quoteHash}.`,
    `Merchant commits quote onchain with MERCHANT_KEY.`,
  ];

  if (rail === PaymentRail.Transfer) {
    steps.push("Agent sends ERC20 transfer to merchant payout address.");
  } else if (rail === PaymentRail.Swap) {
    steps.push("Agent executes approved swap/router calldata, then pays the merchant in the quoted token.");
  } else if (rail === PaymentRail.Facilitator) {
    steps.push("Agent records signed payment policy and facilitator settles the payment.");
  } else if (rail === PaymentRail.X402) {
    steps.push("Agent verifies normalized x402 payload hash, records signed payment policy, and facilitator settles.");
  }

  if ((rail === PaymentRail.Transfer || rail === PaymentRail.Swap) && quote.facilitator.toLowerCase() === ZERO_ADDRESS) {
    steps.push("Current testnet contract semantics may still require a registered facilitator before quote commit or receipt recording.");
  }

  steps.push("Facilitator records receipt, then merchant records fulfillment evidence.");
  return steps;
}

async function fetchHostedDocument(urlEnv: string, hashEnv: string) {
  const url = process.env[urlEnv];
  if (!url) return null;

  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) throw new Error(`${urlEnv} fetch failed: ${response.status} ${response.statusText}`);
  const computedHash = keccak256(toBytes(text));
  const expectedHash = process.env[hashEnv] ?? hashFromUrl(url);
  if (expectedHash && computedHash.toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error(`${urlEnv} hash mismatch: expected ${expectedHash}, got ${computedHash}`);
  }

  return { url, hash: computedHash, json: JSON.parse(text) as unknown };
}

function printDocumentSummary(label: string, document: Awaited<ReturnType<typeof fetchHostedDocument>>) {
  if (!document) {
    console.log(`${label}: not provided`);
    return;
  }
  console.log(`${label}: ${document.hash} ${document.url}`);
}

function quoteFromResponse(value: unknown): QuoteCommitment | null {
  if (!value || typeof value !== "object" || !("quote" in value)) return null;
  const quote = (value as { quote?: unknown }).quote;
  if (!quote || typeof quote !== "object") return null;
  const item = quote as Record<string, unknown>;
  return {
    merchantId: BigInt(String(item.merchantId ?? item.merchant_id)),
    serviceNumericId: BigInt(String(item.serviceNumericId ?? item.service_numeric_id)),
    agent: String(item.agent) as Address,
    token: String(item.token) as Address,
    facilitator: String(item.facilitator ?? "0x0000000000000000000000000000000000000000") as Address,
    amount: BigInt(String(item.amount)),
    paymentRail: Number(item.paymentRail ?? item.payment_rail ?? PaymentRail.Transfer),
    expiresAt: BigInt(String(item.expiresAt ?? item.expires_at)),
    paymentNonce: BigInt(String(item.paymentNonce ?? item.payment_nonce)),
    resourceHash: String(item.resourceHash ?? item.resource_hash) as Hex,
    termsHash: String(item.termsHash ?? item.terms_hash) as Hex,
    x402PayloadHash: String(
      item.x402PayloadHash ??
        item.x402_payload_hash ??
        "0x0000000000000000000000000000000000000000000000000000000000000000",
    ) as Hex,
  };
}

function quoteFromEnv(): QuoteCommitment {
  const x402Payload = process.env.X402_PAYLOAD;
  return {
    merchantId: BigInt(process.env.MERCHANT_ID ?? "1"),
    serviceNumericId: BigInt(process.env.SERVICE_NUMERIC_ID ?? "1"),
    agent: agent.address,
    token: requiredAddress("TOKEN_ADDRESS"),
    facilitator: optionalAddress("FACILITATOR_ADDRESS") ?? ZERO_ADDRESS,
    amount: BigInt(process.env.PAYMENT_AMOUNT ?? "1000000"),
    paymentRail: Number(process.env.PAYMENT_RAIL ?? PaymentRail.Transfer),
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + Number(process.env.QUOTE_TTL_SECONDS ?? "3600")),
    paymentNonce: BigInt(process.env.PAYMENT_NONCE ?? "1"),
    resourceHash: keccak256(stringToHex(process.env.RESOURCE_DESCRIPTOR ?? "cortex-payment-rail-sample")),
    termsHash: keccak256(stringToHex(process.env.TERMS_DOCUMENT ?? "one service response under accepted quote terms")),
    x402PayloadHash: x402Payload
      ? keccak256(stringToHex(x402Payload))
      : "0x0000000000000000000000000000000000000000000000000000000000000000",
  };
}

function hashFromUrl(url: string): string | null {
  const tail = url.split("/").filter(Boolean).at(-1);
  return tail && /^0x[0-9a-fA-F]{64}$/.test(tail) ? tail : null;
}

function requiredAddress(name: string): Address {
  return requiredHex(name) as Address;
}

function optionalAddress(name: string): Address | undefined {
  const value = process.env[name];
  return value ? (value as Address) : undefined;
}

function optionalHex(name: string): Hex | undefined {
  const value = process.env[name];
  return value ? (value as Hex) : undefined;
}

function requiredHex(name: string): Hex {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  if (!value.startsWith("0x")) throw new Error(`${name} must be a 0x value`);
  return value as Hex;
}

function loadEnv(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    process.env[key] ??= value;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
