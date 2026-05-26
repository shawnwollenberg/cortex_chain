import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, keccak256, stringToHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { AgentChainClient, ERC20ABI, PaymentRail, type QuoteCommitment } from "../../sdk/src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv(resolve(__dirname, "..", ".env.testnet"));
loadEnv(resolve(__dirname, "..", "..", "contracts", ".env"));

const API_URL = process.env.API_URL ?? "https://api.cortex.wallyweb.com";
const RPC_URL = process.env.RPC_URL ?? "https://sepolia.base.org";
const EXECUTE_TX = process.env.EXECUTE_TX === "true";

const account = privateKeyToAccount(requiredHex("AGENT_KEY"));
const merchantOwner = requiredAddress("MERCHANT_OWNER_ADDRESS");
const merchantPayout = requiredAddress("MERCHANT_PAYOUT_ADDRESS");
const facilitator = optionalAddress("FACILITATOR_ADDRESS") ?? "0x0000000000000000000000000000000000000000";
const token = requiredAddress("TOKEN_ADDRESS");

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(RPC_URL),
});

const cortex = new AgentChainClient({
  apiUrl: API_URL,
  publicClient,
  walletClient,
  chain: baseSepolia,
  intentBookAddress: requiredAddress("INTENT_BOOK_ADDRESS"),
  commerceRegistryAddress: requiredAddress("COMMERCE_REGISTRY_ADDRESS"),
  policyModuleAddress: requiredAddress("POLICY_MODULE_ADDRESS"),
});

const quote: QuoteCommitment = {
  merchantId: BigInt(process.env.MERCHANT_ID ?? "1"),
  serviceNumericId: BigInt(process.env.SERVICE_NUMERIC_ID ?? "1"),
  agent: account.address,
  token,
  facilitator,
  amount: BigInt(process.env.PAYMENT_AMOUNT ?? "1000000"),
  paymentRail: Number(process.env.PAYMENT_RAIL ?? PaymentRail.Transfer),
  expiresAt: BigInt(Math.floor(Date.now() / 1000) + Number(process.env.QUOTE_TTL_SECONDS ?? "3600")),
  paymentNonce: BigInt(process.env.PAYMENT_NONCE ?? "1"),
  resourceHash: keccak256(stringToHex(process.env.RESOURCE_DESCRIPTOR ?? "cortex-sdk-commerce-flow")),
  termsHash: keccak256(stringToHex(process.env.TERMS_DOCUMENT ?? "one service response under accepted quote terms")),
  x402PayloadHash: process.env.X402_PAYLOAD
    ? keccak256(stringToHex(process.env.X402_PAYLOAD))
    : "0x0000000000000000000000000000000000000000000000000000000000000000",
};

async function main() {
  console.log("Cortex SDK commerce flow");
  console.log(`API: ${API_URL}`);
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Agent: ${account.address}`);

  const quoteHash = await cortex.computeQuoteHash(quote);
  console.log(`Quote hash: ${quoteHash}`);

  const merchantReputation = await cortex.getMerchantReputation(quote.merchantId).catch((error: Error) => ({
    warning: error.message,
  }));
  console.log("Merchant reputation:");
  console.log(JSON.stringify(merchantReputation, null, 2));

  if (!EXECUTE_TX) {
    console.log("Dry run only. Set EXECUTE_TX=true to commit quote and send payment transactions.");
    return;
  }

  if (quote.paymentRail === PaymentRail.X402 || quote.paymentRail === PaymentRail.Facilitator) {
    const policyTx = await cortex.setSignedPaymentPolicy({
      merchant: merchantOwner,
      token: quote.token,
      facilitator: quote.facilitator,
      maxPerPayment: quote.amount,
      maxPerDay: quote.amount * 10n,
      allowed: true,
    });
    console.log(`Signed payment policy tx: ${policyTx}`);
  }

  const commitTx = await cortex.commitQuote(quote);
  console.log(`Commit quote tx: ${commitTx}`);

  if (quote.paymentRail === PaymentRail.Transfer) {
    const transferTx = await walletClient.writeContract({
      account,
      chain: baseSepolia,
      address: quote.token,
      abi: ERC20ABI,
      functionName: "transfer",
      args: [merchantPayout, quote.amount],
    });
    console.log(`ERC20 transfer tx: ${transferTx}`);
  }

  const resultHash = keccak256(stringToHex(process.env.RESULT_DESCRIPTOR ?? "merchant result"));
  const receiptTx = await cortex.recordReceipt(quoteHash, resultHash);
  console.log(`Receipt tx: ${receiptTx}`);
}

function requiredAddress(name: string): Address {
  return requiredHex(name) as Address;
}

function optionalAddress(name: string): Address | undefined {
  const value = process.env[name];
  return value ? (value as Address) : undefined;
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
