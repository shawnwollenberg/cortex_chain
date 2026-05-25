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
 *   2. Register solver and attestor participants
 *   3. Set policy rules (spend limit + target allowlist)
 *   4. Add and use a session key
 *   5. Submit a signed intent (EIP-712)
 *   6. Solver fills the intent
 *   7. Query the API for indexed data
 */

import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import {
  encodeAbiParameters,
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  parseAbi,
  encodePacked,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { AgentChainClient } from "../../sdk/src/index.js";

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
const SOLVER_REGISTRY = process.env.SOLVER_REGISTRY_ADDRESS as Address;
const ATTESTOR_REGISTRY = process.env.ATTESTOR_REGISTRY_ADDRESS as Address;
const COMMERCE_REGISTRY = process.env.COMMERCE_REGISTRY_ADDRESS as Address;

// Anvil account 2 — the "agent"
const AGENT_KEY = (process.env.AGENT_PRIVATE_KEY ??
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a") as Hex;
const SOLVER_KEY = (process.env.SOLVER_PRIVATE_KEY ??
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d") as Hex;

// Anvil account 3 — session key used by the demo agent
const SESSION_KEY =
  "0x7c852118294a2c5c34f3097e1cf29991ef5bea548e497bcd6234c43ec8a848ac" as Hex;
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
  "function setPaymentPolicy(address merchant, address token, address facilitator, uint256 maxPerPayment, uint256 maxPerDay, bool allowed)",
  "function checkSignedPayment(address merchant, address token, address facilitator, uint256 amount)",
  "event SpendLimitSet(address indexed account, address indexed token, uint256 maxPerDay)",
  "event TargetAllowlistUpdated(address indexed account, address indexed target, bool allowed)",
  "event PaymentPolicySet(address indexed account, address indexed merchant, address indexed token, address facilitator, uint256 maxPerPayment, uint256 maxPerDay, bool allowed)",
]);

const IntentBookABI = parseAbi([
  "function submitIntent((address owner, uint8 intentType, (uint256 amountInMax, uint256 amountOutMin, uint256 deadline, uint16 slippageBps) constraints, (address target, bytes32 dataHash, bytes32 requiredAttestationSubject, bytes32 requiredAttestationSchema, bytes32 metadataURIHash) execution, address inputToken, address outputToken, uint256 nonce) intent, uint8 v, bytes32 r, bytes32 s) returns (uint256 intentId)",
  "function submitBid(uint256 intentId, uint256 amountIn, uint256 amountOut, uint256 fee, uint256 validUntil, bytes32 executionHash) returns (uint256 bidId)",
  "function selectBid(uint256 intentId, uint256 bidId)",
  "function getIntentStatus(uint256 intentId) returns (uint8)",
  "event IntentSubmitted(uint256 indexed intentId, address indexed owner, uint256 nonce)",
  "event IntentFilled(uint256 indexed intentId, address indexed solver, uint256 amountIn, uint256 amountOut)",
  "event SolverBidSubmitted(uint256 indexed intentId, uint256 indexed bidId, address indexed solver, uint256 amountIn, uint256 amountOut, uint256 fee, uint256 validUntil, bytes32 executionHash)",
]);

const SolverRegistryABI = parseAbi([
  "function registerSolver(string metadataURI, bytes32 capabilitiesHash) payable returns (uint256 solverId)",
  "event SolverRegistered(uint256 indexed solverId, address indexed operator, string metadataURI, bytes32 capabilitiesHash, uint256 bond)",
]);

const AttestorRegistryABI = parseAbi([
  "function registerAttestor(string metadataURI, bytes32 schemasHash) returns (uint256 attestorId)",
  "event AttestorRegistered(uint256 indexed attestorId, address indexed operator, string metadataURI, bytes32 schemasHash)",
]);

const CommerceRegistryABI = parseAbi([
  "function registerFacilitator(address facilitator, string metadataURI, bytes32 metadataHash) returns (uint256 facilitatorId)",
  "function registerMerchant(address payoutAddress, string metadataURI, bytes32 metadataHash) returns (uint256 merchantId)",
  "function registerService(uint256 merchantId, string serviceId, string metadataURI, bytes32 metadataHash, bytes32 capabilityHash) returns (uint256 serviceNumericId)",
  "function computeQuoteHash(uint256 merchantId, uint256 serviceNumericId, address agent, address token, address facilitator, uint256 amount, uint8 paymentRail, uint256 expiresAt, uint256 paymentNonce, bytes32 resourceHash, bytes32 termsHash, bytes32 x402PayloadHash) view returns (bytes32)",
  "function commitQuote((uint256 merchantId, uint256 serviceNumericId, address agent, address token, address facilitator, uint256 amount, uint8 paymentRail, uint256 expiresAt, uint256 paymentNonce, bytes32 resourceHash, bytes32 termsHash, bytes32 x402PayloadHash) commitment) returns (bytes32 quoteHash)",
  "function recordReceipt(bytes32 quoteHash, bytes32 resultHash) returns (uint256 receiptId)",
  "function recordFulfillment(uint256 receiptId, bytes32 fulfillmentHash)",
  "function recordTrustSignal(uint8 subjectType, uint256 subjectId, uint8 kind, bytes32 signalHash) returns (uint256 signalId)",
  "function openDispute(uint256 receiptId, bytes32 reasonHash) returns (uint256 disputeId)",
  "function resolveDispute(uint256 disputeId, uint8 status, bytes32 resolutionHash)",
  "event FacilitatorRegistered(uint256 indexed facilitatorId, address indexed facilitator, string metadataURI, bytes32 metadataHash)",
  "event MerchantRegistered(uint256 indexed merchantId, address indexed owner, address indexed payoutAddress, string metadataURI, bytes32 metadataHash)",
  "event ServiceRegistered(uint256 indexed serviceNumericId, uint256 indexed merchantId, string serviceId, string metadataURI, bytes32 metadataHash, bytes32 capabilityHash)",
  "event QuoteCommitted(bytes32 indexed quoteHash, uint256 indexed merchantId, uint256 indexed serviceNumericId, address agent, address token, address facilitator, uint256 amount, uint8 paymentRail, uint16 protocolFeeBps, uint256 protocolFeeAmount, uint256 expiresAt, uint256 paymentNonce, bytes32 resourceHash, bytes32 termsHash, bytes32 x402PayloadHash)",
  "event ReceiptRecorded(uint256 indexed receiptId, bytes32 indexed quoteHash, address indexed agent, uint256 merchantId, uint256 serviceNumericId, address token, uint256 amount, uint8 paymentRail, uint16 protocolFeeBps, uint256 protocolFeeAmount, address facilitator, bytes32 resultHash, bytes32 resourceHash, bytes32 fulfillmentHash)",
  "event FulfillmentRecorded(uint256 indexed receiptId, bytes32 fulfillmentHash)",
  "event TrustSignalRecorded(uint256 indexed signalId, uint8 indexed subjectType, uint256 indexed subjectId, uint8 kind, address reporter, bytes32 signalHash)",
  "event DisputeOpened(uint256 indexed disputeId, uint256 indexed receiptId, address indexed opener, bytes32 reasonHash)",
]);

const DemoTargetABI = parseAbi([
  "function setValue(uint256 value)",
  "function value() view returns (uint256)",
]);

const PolicyAccountABI = parseAbi([
  "constructor(address signerAddr, address policyModule)",
  "function setTargetAllowed(address target, bool allowed)",
  "function setSpendLimit(address token, uint256 maxPerDay)",
  "function setGuardian(address guardian)",
  "function setSessionKey(address sessionKey, uint48 expiresAt, bool active)",
  "function executeWithSessionKey(address target, uint256 value, bytes data, uint256 deadline, uint256 nonce, bytes signature) returns (bytes)",
  "function setAccountFrozen(bool frozen)",
  "event SessionKeyUpdated(address indexed sessionKey, uint48 expiresAt, bool active)",
  "event SessionKeyExecuted(address indexed sessionKey, address indexed target, uint256 value, uint256 nonce)",
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

async function waitReceipt(publicClient: ReturnType<typeof createPublicClient>, hash: Hex) {
  return publicClient.waitForTransactionReceipt({ hash });
}

function loadBytecode(artifactPath: string): Hex {
  const artifact = JSON.parse(readFileSync(artifactPath, "utf-8")) as { bytecode: { object: string } };
  return (artifact.bytecode.object.startsWith("0x") ? artifact.bytecode.object : `0x${artifact.bytecode.object}`) as Hex;
}

function sessionDigest(
  accountAddress: Address,
  target: Address,
  value: bigint,
  data: Hex,
  deadline: bigint,
  nonce: bigint,
): Hex {
  const inner = keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "uint256" },
        { type: "address" },
        { type: "uint256" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      [accountAddress, BigInt(foundry.id), target, value, keccak256(data), deadline, nonce],
    ),
  );
  return keccak256(encodePacked(["string", "bytes32"], ["\x19Ethereum Signed Message:\n32", inner]));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const account = privateKeyToAccount(AGENT_KEY);
  const solverAccount = privateKeyToAccount(SOLVER_KEY);
  const sessionAccount = privateKeyToAccount(SESSION_KEY);
  const transport = http(RPC_URL);

  const publicClient = createPublicClient({ chain: foundry, transport });
  const walletClient = createWalletClient({ account, chain: foundry, transport });
  const solverWalletClient = createWalletClient({ account: solverAccount, chain: foundry, transport });

  console.log("Agent-Native L2 — End-to-End Demo");
  console.log(`  RPC:            ${RPC_URL}`);
  console.log(`  API:            ${API_URL}`);
  console.log(`  Agent address:  ${account.address}`);
  console.log(`  AgentRegistry:  ${AGENT_REGISTRY}`);
  console.log(`  IntentBook:     ${INTENT_BOOK}`);
  console.log(`  PolicyModule:   ${POLICY_MODULE}`);
  console.log(`  SolverRegistry: ${SOLVER_REGISTRY}`);
  console.log(`  AttestorRegistry: ${ATTESTOR_REGISTRY}`);
  console.log(`  CommerceRegistry: ${COMMERCE_REGISTRY}`);

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
  // Step 2: Register solver and attestor
  // -----------------------------------------------------------------------
  hr("Step 2: Register Solver and Attestor");

  const solverRegisterHash = await solverWalletClient.writeContract({
    address: SOLVER_REGISTRY,
    abi: SolverRegistryABI,
    functionName: "registerSolver",
    args: ["ipfs://QmDemoSolverMetadata", "0x" + "cd".repeat(32) as Hex],
    value: 1n,
  });
  const solverRegisterReceipt = await waitReceipt(publicClient, solverRegisterHash);
  const solverId = BigInt(solverRegisterReceipt.logs[0].topics[1]!);
  console.log(`  Solver ID: ${solverId} (tx: ${solverRegisterHash})`);

  const attestorRegisterHash = await walletClient.writeContract({
    address: ATTESTOR_REGISTRY,
    abi: AttestorRegistryABI,
    functionName: "registerAttestor",
    args: ["ipfs://QmDemoAttestorMetadata", "0x" + "ef".repeat(32) as Hex],
  });
  const attestorRegisterReceipt = await waitReceipt(publicClient, attestorRegisterHash);
  const attestorId = BigInt(attestorRegisterReceipt.logs[0].topics[1]!);
  console.log(`  Attestor ID: ${attestorId} (tx: ${attestorRegisterHash})`);

  // -----------------------------------------------------------------------
  // Step 2b: Register commerce primitives
  // -----------------------------------------------------------------------
  hr("Step 2b: Register Merchant, Service, and Facilitator");

  const facilitatorHash = await solverWalletClient.writeContract({
    address: COMMERCE_REGISTRY,
    abi: CommerceRegistryABI,
    functionName: "registerFacilitator",
    args: [solverAccount.address, "ipfs://QmDemoFacilitatorMetadata", "0x" + "fa".repeat(32) as Hex],
  });
  const facilitatorReceipt = await waitReceipt(publicClient, facilitatorHash);
  const facilitatorId = BigInt(facilitatorReceipt.logs[0].topics[1]!);

  const merchantHash = await walletClient.writeContract({
    address: COMMERCE_REGISTRY,
    abi: CommerceRegistryABI,
    functionName: "registerMerchant",
    args: [account.address, "ipfs://QmDemoMerchantMetadata", "0x" + "12".repeat(32) as Hex],
  });
  const merchantReceipt = await waitReceipt(publicClient, merchantHash);
  const merchantId = BigInt(merchantReceipt.logs[0].topics[1]!);

  const serviceHash = await walletClient.writeContract({
    address: COMMERCE_REGISTRY,
    abi: CommerceRegistryABI,
    functionName: "registerService",
    args: [
      merchantId,
      "demo.set-value",
      "ipfs://QmDemoServiceCatalog",
      "0x" + "34".repeat(32) as Hex,
      "0x" + "56".repeat(32) as Hex,
    ],
  });
  const serviceReceipt = await waitReceipt(publicClient, serviceHash);
  const serviceNumericId = BigInt(serviceReceipt.logs[0].topics[1]!);
  console.log(`  Facilitator ID: ${facilitatorId} (tx: ${facilitatorHash})`);
  console.log(`  Merchant ID:    ${merchantId} (tx: ${merchantHash})`);
  console.log(`  Service ID:     ${serviceNumericId} (tx: ${serviceHash})`);

  // -----------------------------------------------------------------------
  // Step 3: Set policies
  // -----------------------------------------------------------------------
  hr("Step 3: Configure Policy Rules");

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

  const paymentPolicyHash = await walletClient.writeContract({
    address: POLICY_MODULE,
    abi: PolicyModuleABI,
    functionName: "setPaymentPolicy",
    args: [account.address, INPUT_TOKEN, solverAccount.address, 5n * 10n ** 18n, 25n * 10n ** 18n, true],
  });
  await publicClient.waitForTransactionReceipt({ hash: paymentPolicyHash });
  await publicClient.simulateContract({
    address: POLICY_MODULE,
    abi: PolicyModuleABI,
    functionName: "checkSignedPayment",
    args: [account.address, INPUT_TOKEN, solverAccount.address, 1n * 10n ** 18n],
    account: account.address,
  });
  console.log(`  x402 payment policy: merchant=${account.address}, facilitator=${solverAccount.address} (tx: ${paymentPolicyHash})`);

  // -----------------------------------------------------------------------
  // Step 4: Deploy policy account and use session key
  // -----------------------------------------------------------------------
  hr("Step 4: Session-Key Policy Execution");

  const deployPolicyAccountHash = await walletClient.deployContract({
    abi: PolicyAccountABI,
    bytecode: loadBytecode(resolve(__dirname, "..", "..", "contracts", "out", "PolicyAccount.sol", "PolicyAccount.json")),
    args: [account.address, POLICY_MODULE],
  });
  const policyAccountReceipt = await waitReceipt(publicClient, deployPolicyAccountHash);
  const policyAccount = policyAccountReceipt.contractAddress!;
  console.log(`  PolicyAccount: ${policyAccount} (tx: ${deployPolicyAccountHash})`);

  const deployTargetHash = await walletClient.deployContract({
    abi: DemoTargetABI,
    bytecode: loadBytecode(resolve(__dirname, "..", "..", "contracts", "out", "DemoTarget.sol", "DemoTarget.json")),
  });
  const targetReceipt = await waitReceipt(publicClient, deployTargetHash);
  const demoTarget = targetReceipt.contractAddress!;
  console.log(`  DemoTarget:    ${demoTarget} (tx: ${deployTargetHash})`);

  await waitReceipt(publicClient, await walletClient.writeContract({
    address: policyAccount,
    abi: PolicyAccountABI,
    functionName: "setTargetAllowed",
    args: [demoTarget, true],
  }));

  await waitReceipt(publicClient, await walletClient.writeContract({
    address: policyAccount,
    abi: PolicyAccountABI,
    functionName: "setSessionKey",
    args: [sessionAccount.address, Math.floor(Date.now() / 1000) + 3600, true],
  }));
  console.log(`  Session key:   ${sessionAccount.address}`);

  const setValueData = "0x55241077000000000000000000000000000000000000000000000000000000000000002a" as Hex;
  const sessionDeadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const sessionNonce = 1n;
  const sig = await sessionAccount.sign({ hash: sessionDigest(policyAccount, demoTarget, 0n, setValueData, sessionDeadline, sessionNonce) });

  const sessionExecHash = await walletClient.writeContract({
    address: policyAccount,
    abi: PolicyAccountABI,
    functionName: "executeWithSessionKey",
    args: [demoTarget, 0n, setValueData, sessionDeadline, sessionNonce, sig],
  });
  await waitReceipt(publicClient, sessionExecHash);
  const targetValue = await publicClient.readContract({
    address: demoTarget,
    abi: DemoTargetABI,
    functionName: "value",
  });
  console.log(`  Session execution tx: ${sessionExecHash}`);
  console.log(`  DemoTarget value:     ${targetValue}`);

  // -----------------------------------------------------------------------
  // Step 5: Submit EIP-712 signed intent
  // -----------------------------------------------------------------------
  hr("Step 5: Submit Signed Intent");

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

  const agentClient = new AgentChainClient({
    apiUrl: API_URL,
    publicClient,
    walletClient,
    intentBookAddress: INTENT_BOOK,
    chain: foundry,
  });
  const intentExecutionData = "0x55241077000000000000000000000000000000000000000000000000000000000000002b" as Hex;

  const sdkResult = await agentClient.createIntent({
    intent,
    metadata: {
      metadata_uri: "ipfs://QmDemoIntentMetadata",
      execution_target: demoTarget,
      execution_data: intentExecutionData,
    },
    preflight: {
      account: account.address,
      target: INTENT_BOOK,
      value: "0",
      data: "0x",
    },
  });

  const submitHash = sdkResult.txHash;
  const intentId = sdkResult.intentId;
  console.log(`  Tx:        ${submitHash}`);
  console.log(`  Intent ID: ${intentId}`);
  console.log(`  Intent hash: ${sdkResult.intentHash}`);
  console.log(`  Metadata reserved: ${sdkResult.metadataReserved}`);
  console.log(`  Indexed through SDK: ${sdkResult.indexed}`);
  console.log(`  Status:    OPEN`);

  const bidHash = await solverWalletClient.writeContract({
    address: INTENT_BOOK,
    abi: IntentBookABI,
    functionName: "submitBid",
    args: [
      intentId,
      intent.constraints.amountInMax,
      intent.constraints.amountOutMin,
      0n,
      deadline,
      keccak256(intentExecutionData),
    ],
  });
  const bidReceipt = await waitReceipt(publicClient, bidHash);
  let bidId = 1n;
  for (const log of bidReceipt.logs) {
    if (log.topics[0] === "0x945dc28abc0cba878756055fcf99d9468881eab2b23e9f9d2a9897aee17aabc4") {
      bidId = BigInt(log.topics[2]!);
      break;
    }
  }
  const selectBidHash = await walletClient.writeContract({
    address: INTENT_BOOK,
    abi: IntentBookABI,
    functionName: "selectBid",
    args: [intentId, bidId],
  });
  await waitReceipt(publicClient, selectBidHash);
  console.log(`  Onchain bid: ${bidId} (tx: ${bidHash})`);
  console.log(`  Selected bid tx: ${selectBidHash}`);

  // -----------------------------------------------------------------------
  // Step 6: Wait for solver to fill
  // -----------------------------------------------------------------------
  hr("Step 6: Wait for Solver Fill");

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
  // Step 6b: Record commerce quote, receipt, and dispute signal
  // -----------------------------------------------------------------------
  hr("Step 6b: Commerce Quote, Receipt, and Dispute Signal");

  const resourceHash = keccak256(intentExecutionData);
  const termsHash = "0x" + "78".repeat(32) as Hex;
  const x402PayloadHash = "0x" + "90".repeat(32) as Hex;
  const quoteExpiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const paymentNonce = 1n;
  const paymentRail = 3;
  const quoteHash = await publicClient.readContract({
    address: COMMERCE_REGISTRY,
    abi: CommerceRegistryABI,
    functionName: "computeQuoteHash",
    args: [
      merchantId,
      serviceNumericId,
      account.address,
      INPUT_TOKEN,
      solverAccount.address,
      1n * 10n ** 18n,
      paymentRail,
      quoteExpiresAt,
      paymentNonce,
      resourceHash,
      termsHash,
      x402PayloadHash,
    ],
  });

  const quoteHashTx = await walletClient.writeContract({
    address: COMMERCE_REGISTRY,
    abi: CommerceRegistryABI,
    functionName: "commitQuote",
    args: [
      {
        merchantId,
        serviceNumericId,
        agent: account.address,
        token: INPUT_TOKEN,
        facilitator: solverAccount.address,
        amount: 1n * 10n ** 18n,
        paymentRail,
        expiresAt: quoteExpiresAt,
        paymentNonce,
        resourceHash,
        termsHash,
        x402PayloadHash,
      },
    ],
  });
  await waitReceipt(publicClient, quoteHashTx);

  const receiptTx = await solverWalletClient.writeContract({
    address: COMMERCE_REGISTRY,
    abi: CommerceRegistryABI,
    functionName: "recordReceipt",
    args: [quoteHash, keccak256("0x" + "99".repeat(32) as Hex)],
  });
  const commerceReceipt = await waitReceipt(publicClient, receiptTx);
  const commerceReceiptId = BigInt(commerceReceipt.logs[0].topics[1]!);

  const fulfillmentHash = "0x" + "79".repeat(32) as Hex;
  const fulfillmentTx = await walletClient.writeContract({
    address: COMMERCE_REGISTRY,
    abi: CommerceRegistryABI,
    functionName: "recordFulfillment",
    args: [commerceReceiptId, fulfillmentHash],
  });
  await waitReceipt(publicClient, fulfillmentTx);

  const verificationSignalTx = await walletClient.writeContract({
    address: COMMERCE_REGISTRY,
    abi: CommerceRegistryABI,
    functionName: "recordTrustSignal",
    args: [0, merchantId, 0, "0x" + "91".repeat(32) as Hex],
  });
  await waitReceipt(publicClient, verificationSignalTx);

  const fulfillmentSignalTx = await solverWalletClient.writeContract({
    address: COMMERCE_REGISTRY,
    abi: CommerceRegistryABI,
    functionName: "recordTrustSignal",
    args: [1, serviceNumericId, 3, "0x" + "92".repeat(32) as Hex],
  });
  await waitReceipt(publicClient, fulfillmentSignalTx);

  const disputeTx = await walletClient.writeContract({
    address: COMMERCE_REGISTRY,
    abi: CommerceRegistryABI,
    functionName: "openDispute",
    args: [commerceReceiptId, "0x" + "88".repeat(32) as Hex],
  });
  const disputeReceipt = await waitReceipt(publicClient, disputeTx);
  const disputeId = BigInt(disputeReceipt.logs[0].topics[1]!);

  const resolveDisputeTx = await walletClient.writeContract({
    address: COMMERCE_REGISTRY,
    abi: CommerceRegistryABI,
    functionName: "resolveDispute",
    args: [disputeId, 1, "0x" + "77".repeat(32) as Hex],
  });
  await waitReceipt(publicClient, resolveDisputeTx);
  console.log(`  Quote:   ${quoteHash} (tx: ${quoteHashTx})`);
  console.log(`  Receipt: ${commerceReceiptId} (tx: ${receiptTx})`);
  console.log(`  Fulfillment hash recorded (tx: ${fulfillmentTx})`);
  console.log(`  Trust signals recorded (txs: ${verificationSignalTx}, ${fulfillmentSignalTx})`);
  console.log(`  Dispute: ${disputeId} resolved (tx: ${resolveDisputeTx})`);

  // -----------------------------------------------------------------------
  // Step 7: Wait for indexer to catch up, then query API
  // -----------------------------------------------------------------------
  hr("Step 7: Query API Endpoints");

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

  console.log(`\n  POST /preflight`);
  const preflight = await fetch(`${API_URL}/preflight`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      account: account.address,
      target: INTENT_BOOK,
      value: "0",
      data: "0x",
    }),
  }).then((res) => res.json());
  console.log(`  Response: ${JSON.stringify(preflight, null, 2)}`);

  console.log(`\n  GET /solvers?active=true`);
  const solvers = await apiGet("/solvers?active=true");
  console.log(`  Response: ${JSON.stringify(solvers, null, 2)}`);

  console.log(`\n  GET /intents/${intentId}/bids`);
  const bids = await apiGet(`/intents/${intentId}/bids`);
  console.log(`  Response: ${JSON.stringify(bids, null, 2)}`);

  console.log(`\n  GET /attestations/schemas`);
  const schemas = await apiGet("/attestations/schemas");
  console.log(`  Response: ${JSON.stringify(schemas, null, 2)}`);

  console.log(`\n  GET /attestors?active=true`);
  const attestors = await apiGet("/attestors?active=true");
  console.log(`  Response: ${JSON.stringify(attestors, null, 2)}`);

  console.log(`\n  GET /merchants/${merchantId}`);
  const merchantData = await apiGet(`/merchants/${merchantId}`);
  console.log(`  Response: ${JSON.stringify(merchantData, null, 2)}`);

  console.log(`\n  GET /services?merchant_id=${merchantId}`);
  const serviceData = await apiGet(`/services?merchant_id=${merchantId}`);
  console.log(`  Response: ${JSON.stringify(serviceData, null, 2)}`);

  console.log(`\n  GET /facilitators?active=true`);
  const facilitatorData = await apiGet("/facilitators?active=true");
  console.log(`  Response: ${JSON.stringify(facilitatorData, null, 2)}`);

  console.log(`\n  GET /quotes/${quoteHash}`);
  const quoteData = await apiGet(`/quotes/${quoteHash}`);
  console.log(`  Response: ${JSON.stringify(quoteData, null, 2)}`);

  console.log(`\n  GET /receipts?agent=${account.address}`);
  const receiptData = await apiGet(`/receipts?agent=${account.address}`);
  console.log(`  Response: ${JSON.stringify(receiptData, null, 2)}`);

  console.log(`\n  GET /disputes?receipt_id=${commerceReceiptId}`);
  const disputeData = await apiGet(`/disputes?receipt_id=${commerceReceiptId}`);
  console.log(`  Response: ${JSON.stringify(disputeData, null, 2)}`);

  console.log(`\n  GET /trust-signals?subject_type=0&subject_id=${merchantId}`);
  const trustSignals = await apiGet(`/trust-signals?subject_type=0&subject_id=${merchantId}`);
  console.log(`  Response: ${JSON.stringify(trustSignals, null, 2)}`);

  console.log(`\n  GET /merchants/${merchantId}/reputation`);
  const reputationData = await apiGet(`/merchants/${merchantId}/reputation`);
  console.log(`  Response: ${JSON.stringify(reputationData, null, 2)}`);

  console.log(`\n  GET /analytics/commerce`);
  const commerceAnalytics = await apiGet("/analytics/commerce");
  console.log(`  Response: ${JSON.stringify(commerceAnalytics, null, 2)}`);

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
  console.log(`  Solver ID:      ${solverId}`);
  console.log(`  Attestor ID:    ${attestorId}`);
  console.log(`  PolicyAccount:  ${policyAccount}`);
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
