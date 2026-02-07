/**
 * End-to-end demo script for the Agent-Native Ethereum L2.
 *
 * Prerequisites:
 *   1. Anvil running on localhost:8545
 *   2. Contracts deployed (ops/deploy.sh)
 *   3. Indexer, Solver, API running (ops/start-services.sh)
 *
 * Demonstrates:
 *   1. Register an Agent Identity
 *   2. Set policy rules (spend limit + target allowlist)
 *   3. Submit a signed intent (EIP-712)
 *   4. Solver fills the intent
 *   5. Query the API for indexed data
 */

import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.deployed") });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const API_URL = process.env.API_URL ?? "http://localhost:3001";

const AGENT_REGISTRY = process.env.AGENT_REGISTRY_ADDRESS as Address;
const INTENT_BOOK = process.env.INTENT_BOOK_ADDRESS as Address;
const POLICY_MODULE = process.env.POLICY_MODULE_ADDRESS as Address;

// Anvil account 2 — the "agent"
const AGENT_KEY = (process.env.AGENT_PRIVATE_KEY ??
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a") as Hex;

// Dummy token addresses (used as identifiers only — no real ERC-20 on devnet)
const INPUT_TOKEN = "0x1111111111111111111111111111111111111111" as Address;
const OUTPUT_TOKEN = "0x2222222222222222222222222222222222222222" as Address;

// ---------------------------------------------------------------------------
// ABIs (minimal subsets needed for the demo)
// ---------------------------------------------------------------------------
const AgentRegistryABI = parseAbi([
  "function registerAgent(string metadataURI, bytes pubkey, bytes32 capabilitiesHash) returns (uint256 agentId)",
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, string metadataURI)",
]);

const PolicyModuleABI = parseAbi([
  "function setSpendLimit(address token, uint256 maxPerDay)",
  "function setTargetAllowed(address target, bool allowed)",
  "event SpendLimitSet(address indexed account, address indexed token, uint256 maxPerDay)",
  "event TargetAllowlistUpdated(address indexed account, address indexed target, bool allowed)",
]);

const IntentBookABI = parseAbi([
  "function submitIntent((address owner, uint8 intentType, (uint256 amountInMax, uint256 amountOutMin, uint256 deadline, uint16 slippageBps) constraints, address inputToken, address outputToken, uint256 nonce) intent, uint8 v, bytes32 r, bytes32 s) returns (uint256 intentId)",
  "function getIntentStatus(uint256 intentId) returns (uint8)",
  "event IntentSubmitted(uint256 indexed intentId, address indexed owner, uint256 nonce)",
  "event IntentFilled(uint256 indexed intentId, address indexed solver, uint256 amountIn, uint256 amountOut)",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function hr(title: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiGet(path: string): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const account = privateKeyToAccount(AGENT_KEY);
  const transport = http(RPC_URL);

  const publicClient = createPublicClient({ chain: foundry, transport });
  const walletClient = createWalletClient({ account, chain: foundry, transport });

  console.log("Agent-Native L2 — End-to-End Demo");
  console.log(`  RPC:            ${RPC_URL}`);
  console.log(`  API:            ${API_URL}`);
  console.log(`  Agent address:  ${account.address}`);
  console.log(`  AgentRegistry:  ${AGENT_REGISTRY}`);
  console.log(`  IntentBook:     ${INTENT_BOOK}`);
  console.log(`  PolicyModule:   ${POLICY_MODULE}`);

  // -----------------------------------------------------------------------
  // Step 1: Register Agent
  // -----------------------------------------------------------------------
  hr("Step 1: Register Agent Identity");

  const registerHash = await walletClient.writeContract({
    address: AGENT_REGISTRY,
    abi: AgentRegistryABI,
    functionName: "registerAgent",
    args: [
      "ipfs://QmDemoAgentMetadata",
      "0x04deadbeef" as Hex,
      "0x" + "ab".repeat(32) as Hex,
    ],
  });
  const registerReceipt = await publicClient.waitForTransactionReceipt({ hash: registerHash });
  console.log(`  Tx:       ${registerHash}`);
  console.log(`  Block:    ${registerReceipt.blockNumber}`);
  console.log(`  Status:   ${registerReceipt.status}`);

  // Parse agentId from event
  const registerLog = registerReceipt.logs[0];
  const agentId = BigInt(registerLog.topics[1]!);
  console.log(`  Agent ID: ${agentId}`);

  // -----------------------------------------------------------------------
  // Step 2: Set policies
  // -----------------------------------------------------------------------
  hr("Step 2: Configure Policy Rules");

  // Set spend limit: 10,000 units/day for INPUT_TOKEN
  const spendHash = await walletClient.writeContract({
    address: POLICY_MODULE,
    abi: PolicyModuleABI,
    functionName: "setSpendLimit",
    args: [INPUT_TOKEN, 10000n * 10n ** 18n],
  });
  await publicClient.waitForTransactionReceipt({ hash: spendHash });
  console.log(`  Spend limit set: ${INPUT_TOKEN} → 10,000/day (tx: ${spendHash})`);

  // Allowlist the IntentBook as a target
  const allowHash = await walletClient.writeContract({
    address: POLICY_MODULE,
    abi: PolicyModuleABI,
    functionName: "setTargetAllowed",
    args: [INTENT_BOOK, true],
  });
  await publicClient.waitForTransactionReceipt({ hash: allowHash });
  console.log(`  Target allowed:  ${INTENT_BOOK} (tx: ${allowHash})`);

  // -----------------------------------------------------------------------
  // Step 3: Submit EIP-712 signed intent
  // -----------------------------------------------------------------------
  hr("Step 3: Submit Signed Intent");

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

  const intent = {
    owner: account.address,
    intentType: 0, // SWAP_EXACT_IN_MAX_SLIPPAGE
    constraints: {
      amountInMax: 1000n * 10n ** 18n,
      amountOutMin: 900n * 10n ** 18n,
      deadline,
      slippageBps: 100, // 1%
    },
    inputToken: INPUT_TOKEN,
    outputToken: OUTPUT_TOKEN,
    nonce: 1n,
  } as const;

  // Sign EIP-712 typed data
  const signature = await walletClient.signTypedData({
    domain: {
      name: "AgentIntentBook",
      version: "1",
      chainId: foundry.id,
      verifyingContract: INTENT_BOOK,
    },
    types: {
      Intent: [
        { name: "owner", type: "address" },
        { name: "intentType", type: "uint8" },
        { name: "constraints", type: "Constraints" },
        { name: "inputToken", type: "address" },
        { name: "outputToken", type: "address" },
        { name: "nonce", type: "uint256" },
      ],
      Constraints: [
        { name: "amountInMax", type: "uint256" },
        { name: "amountOutMin", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "slippageBps", type: "uint16" },
      ],
    },
    primaryType: "Intent",
    message: {
      owner: intent.owner,
      intentType: intent.intentType,
      constraints: {
        amountInMax: intent.constraints.amountInMax,
        amountOutMin: intent.constraints.amountOutMin,
        deadline: intent.constraints.deadline,
        slippageBps: intent.constraints.slippageBps,
      },
      inputToken: intent.inputToken,
      outputToken: intent.outputToken,
      nonce: intent.nonce,
    },
  });

  // Split signature into v, r, s
  const r = `0x${signature.slice(2, 66)}` as Hex;
  const s = `0x${signature.slice(66, 130)}` as Hex;
  const v = parseInt(signature.slice(130, 132), 16);

  console.log(`  Signature: ${signature.slice(0, 20)}...`);
  console.log(`  v=${v}, r=${r.slice(0, 10)}..., s=${s.slice(0, 10)}...`);

  const submitHash = await walletClient.writeContract({
    address: INTENT_BOOK,
    abi: IntentBookABI,
    functionName: "submitIntent",
    args: [
      {
        owner: intent.owner,
        intentType: intent.intentType,
        constraints: {
          amountInMax: intent.constraints.amountInMax,
          amountOutMin: intent.constraints.amountOutMin,
          deadline: intent.constraints.deadline,
          slippageBps: intent.constraints.slippageBps,
        },
        inputToken: intent.inputToken,
        outputToken: intent.outputToken,
        nonce: intent.nonce,
      },
      v,
      r,
      s,
    ],
  });
  const submitReceipt = await publicClient.waitForTransactionReceipt({ hash: submitHash });
  const intentId = BigInt(submitReceipt.logs[0].topics[1]!);
  console.log(`  Tx:        ${submitHash}`);
  console.log(`  Intent ID: ${intentId}`);
  console.log(`  Status:    OPEN`);

  // -----------------------------------------------------------------------
  // Step 4: Wait for solver to fill
  // -----------------------------------------------------------------------
  hr("Step 4: Wait for Solver Fill");

  console.log("  Waiting for solver to pick up and fill the intent...");

  let filled = false;
  for (let i = 0; i < 30; i++) {
    const status = await publicClient.readContract({
      address: INTENT_BOOK,
      abi: IntentBookABI,
      functionName: "getIntentStatus",
      args: [intentId],
    });
    // 0=OPEN, 1=FILLED, 2=CANCELLED, 3=EXPIRED
    if (status === 1) {
      filled = true;
      console.log(`  Intent ${intentId} FILLED after ~${(i + 1) * 2}s`);
      break;
    }
    await sleep(2000);
  }

  if (!filled) {
    console.log("  WARNING: Intent was not filled within 60 seconds.");
    console.log("  The solver may not be running or may have rejected the intent.");
    console.log("  Continuing to API queries...");
  }

  // -----------------------------------------------------------------------
  // Step 5: Wait for indexer to catch up, then query API
  // -----------------------------------------------------------------------
  hr("Step 5: Query API Endpoints");

  // Give indexer a few seconds to catch up
  console.log("  Waiting for indexer to index events...");
  await sleep(4000);

  // GET /agents/:agentId
  console.log(`\n  GET /agents/${agentId}`);
  const agentData = await apiGet(`/agents/${agentId}`);
  console.log(`  Response: ${JSON.stringify(agentData, null, 2)}`);

  // GET /agents?owner=...
  console.log(`\n  GET /agents?owner=${account.address.toLowerCase()}`);
  const agentsByOwner = await apiGet(`/agents?owner=${account.address}`);
  console.log(`  Response: ${JSON.stringify(agentsByOwner, null, 2)}`);

  // GET /accounts/:address/policies
  console.log(`\n  GET /accounts/${account.address.toLowerCase()}/policies`);
  const policies = await apiGet(`/accounts/${account.address}/policies`);
  console.log(`  Response: ${JSON.stringify(policies, null, 2)}`);

  // GET /intents?status=open
  console.log(`\n  GET /intents?status=${filled ? "filled" : "open"}`);
  const intents = await apiGet(`/intents?status=${filled ? "filled" : "open"}`);
  console.log(`  Response: ${JSON.stringify(intents, null, 2)}`);

  // GET /intents/:id
  console.log(`\n  GET /intents/${intentId}`);
  const intentData = await apiGet(`/intents/${intentId}`);
  console.log(`  Response: ${JSON.stringify(intentData, null, 2)}`);

  // GET /tx/:hash/explain
  console.log(`\n  GET /tx/${submitHash}/explain`);
  const txExplain = await apiGet(`/tx/${submitHash}/explain`);
  console.log(`  Response: ${JSON.stringify(txExplain, null, 2)}`);

  // GET /health
  console.log(`\n  GET /health`);
  const health = await apiGet("/health");
  console.log(`  Response: ${JSON.stringify(health)}`);

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  hr("Demo Summary");
  console.log(`  Agent ID:       ${agentId}`);
  console.log(`  Agent Address:  ${account.address}`);
  console.log(`  Intent ID:      ${intentId}`);
  console.log(`  Intent Status:  ${filled ? "FILLED" : "OPEN (solver may not be running)"}`);
  console.log(`  Register Tx:    ${registerHash}`);
  console.log(`  Submit Tx:      ${submitHash}`);
  console.log(`\n  Demo complete.`);
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
