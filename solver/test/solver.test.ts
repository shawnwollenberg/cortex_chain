import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess, execSync } from "node:child_process";
import {
  createPublicClient,
  createWalletClient,
  http,
  decodeEventLog,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { IntentBookABI } from "../src/abi/IntentBook.js";
import { IntentListener } from "../src/listener.js";
import { IntentExecutor } from "../src/executor.js";
import { IntentStatus, IntentType } from "../src/types.js";

const RPC_URL = "http://127.0.0.1:8545";
// Anvil default accounts
const DEPLOYER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const SOLVER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const AGENT_KEY =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex;

const CONTRACTS_DIR = new URL("../../contracts", import.meta.url).pathname;

let anvil: ChildProcess;
let intentBookAddress: Address;

const publicClient = createPublicClient({
  chain: foundry,
  transport: http(RPC_URL),
  cacheTime: 0,
});

const deployerWallet = createWalletClient({
  account: privateKeyToAccount(DEPLOYER_KEY),
  chain: foundry,
  transport: http(RPC_URL),
});

const solverAccount = privateKeyToAccount(SOLVER_KEY);
const solverWallet = createWalletClient({
  account: solverAccount,
  chain: foundry,
  transport: http(RPC_URL),
});

const agentAccount = privateKeyToAccount(AGENT_KEY);
const agentWallet = createWalletClient({
  account: agentAccount,
  chain: foundry,
  transport: http(RPC_URL),
});

function waitForAnvil(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Anvil startup timeout")),
      10_000,
    );
    const check = async () => {
      try {
        await publicClient.getBlockNumber();
        clearTimeout(timeout);
        resolve();
      } catch {
        setTimeout(check, 200);
      }
    };
    check();
  });
}

function deployContracts(): Address {
  const output = execSync(
    `forge script script/Deploy.s.sol --rpc-url ${RPC_URL} --broadcast --private-key ${DEPLOYER_KEY}`,
    { cwd: CONTRACTS_DIR, encoding: "utf-8", timeout: 30_000 },
  );

  // Parse "IntentBook deployed at: 0x..." from forge output
  const match = output.match(/IntentBook deployed at:\s+(0x[0-9a-fA-F]{40})/);
  if (!match) {
    throw new Error(`Failed to parse IntentBook address from:\n${output}`);
  }
  return match[1] as Address;
}

async function submitTestIntent(
  deadline: bigint,
  nonce: bigint,
): Promise<bigint> {
  const intent = {
    owner: agentAccount.address,
    intentType: IntentType.SWAP_EXACT_IN_MAX_SLIPPAGE,
    constraints: {
      amountInMax: 1000n,
      amountOutMin: 900n,
      deadline,
      slippageBps: 100,
    },
    inputToken: "0x0000000000000000000000000000000000000001" as Address,
    outputToken: "0x0000000000000000000000000000000000000002" as Address,
    nonce,
  };

  // Get chain ID and domain from the contract
  const [, , , chainId, verifyingContract] = await publicClient.readContract({
    address: intentBookAddress,
    abi: IntentBookABI,
    functionName: "eip712Domain",
  });

  // Sign via EIP-712
  const signature = await agentWallet.signTypedData({
    domain: {
      name: "AgentIntentBook",
      version: "1",
      chainId: Number(chainId),
      verifyingContract,
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

  const { request } = await publicClient.simulateContract({
    address: intentBookAddress,
    abi: IntentBookABI,
    functionName: "submitIntent",
    args: [intent, v, r, s],
    account: agentAccount,
  });

  const txHash = await agentWallet.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });
  expect(receipt.status).toBe("success");

  // Parse IntentSubmitted event to get intentId
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: IntentBookABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "IntentSubmitted") {
        return (decoded.args as { intentId: bigint }).intentId;
      }
    } catch {
      // Not an IntentBook event
    }
  }

  throw new Error("IntentSubmitted event not found in receipt");
}

describe("Solver integration", () => {
  beforeAll(async () => {
    // Start Anvil
    anvil = spawn("anvil", ["--port", "8545"], {
      stdio: "pipe",
    });
    anvil.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString();
      if (msg.includes("error") || msg.includes("Error")) {
        console.error("[anvil]", msg);
      }
    });

    await waitForAnvil();
    intentBookAddress = deployContracts();
    console.log(`IntentBook deployed at: ${intentBookAddress}`);
  }, 30_000);

  afterAll(() => {
    if (anvil) {
      anvil.kill("SIGTERM");
    }
  });

  it("should detect and fill a valid intent", async () => {
    const block = await publicClient.getBlock();
    const deadline = block.timestamp + 3600n; // 1 hour from now
    // Record block number before submit — the TX will land in a new block
    const blockBeforeSubmit = block.number;

    // Submit intent (creates a new block via auto-mine)
    const intentId = await submitTestIntent(deadline, 1n);
    expect(intentId).toBeGreaterThan(0n);

    // Verify it's OPEN
    const statusBefore = await publicClient.readContract({
      address: intentBookAddress,
      abi: IntentBookABI,
      functionName: "getIntentStatus",
      args: [intentId],
    });
    expect(statusBefore).toBe(IntentStatus.OPEN);

    // Create listener starting from the block where the submit TX was mined
    const listener = new IntentListener(
      publicClient,
      intentBookAddress,
      blockBeforeSubmit + 1n,
    );
    const executor = new IntentExecutor(
      publicClient,
      solverWallet,
      intentBookAddress,
    );

    // Poll for events — the submit TX should be in block range
    const events = await listener.pollForEvents();
    expect(events.length).toBeGreaterThanOrEqual(1);

    const event = events.find((e) => e.intentId === intentId);
    expect(event).toBeDefined();

    // Process (fill) the intent
    const result = await executor.processIntent(intentId);
    expect(result).toBe(true);

    // Verify it's now FILLED
    const statusAfter = await publicClient.readContract({
      address: intentBookAddress,
      abi: IntentBookABI,
      functionName: "getIntentStatus",
      args: [intentId],
    });
    expect(statusAfter).toBe(IntentStatus.FILLED);
  });

  it("should skip an already-filled intent", async () => {
    const currentBlock = await publicClient.getBlockNumber();
    const block = await publicClient.getBlock({ blockNumber: currentBlock });
    const deadline = block.timestamp + 3600n;

    // Submit and fill an intent
    const intentId = await submitTestIntent(deadline, 2n);
    const executor = new IntentExecutor(
      publicClient,
      solverWallet,
      intentBookAddress,
    );

    // Fill it first
    const firstResult = await executor.processIntent(intentId);
    expect(firstResult).toBe(true);

    // Try to fill again — should skip
    const secondResult = await executor.processIntent(intentId);
    expect(secondResult).toBe(false);
  });

  it("should skip an expired intent", async () => {
    const block = await publicClient.getBlock();
    // Deadline 60s in the future — enough for submit to succeed
    const deadline = block.timestamp + 60n;

    const intentId = await submitTestIntent(deadline, 3n);

    // Advance time well past the deadline
    await publicClient.request({
      method: "evm_increaseTime" as any,
      params: [120],
    });
    await publicClient.request({
      method: "evm_mine" as any,
      params: [],
    });

    const executor = new IntentExecutor(
      publicClient,
      solverWallet,
      intentBookAddress,
    );

    // Should fail — the validator catches expiry offchain, or the contract reverts
    const result = await executor.processIntent(intentId);
    expect(result).toBe(false);
  });
});
