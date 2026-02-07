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
import pg from "pg";
import { AgentRegistryABI } from "../src/abi/AgentRegistry.js";
import { IntentBookABI } from "../src/abi/IntentBook.js";
import { PolicyModuleABI } from "../src/abi/PolicyModule.js";
import { EventPoller } from "../src/listener.js";
import { runMigrations, getLastProcessedBlock } from "../src/db.js";

const RPC_URL = "http://127.0.0.1:8545";
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://localhost:5432/ai_chain_indexer_test";

// Anvil default accounts
const DEPLOYER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const AGENT_KEY =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex;
const SOLVER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;

const CONTRACTS_DIR = new URL("../../contracts", import.meta.url).pathname;

let anvil: ChildProcess;
let pool: pg.Pool;
let agentRegistryAddress: Address;
let intentBookAddress: Address;
let policyModuleAddress: Address;

const publicClient = createPublicClient({
  chain: foundry,
  transport: http(RPC_URL),
  cacheTime: 0,
});

const deployerAccount = privateKeyToAccount(DEPLOYER_KEY);
const deployerWallet = createWalletClient({
  account: deployerAccount,
  chain: foundry,
  transport: http(RPC_URL),
});

const agentAccount = privateKeyToAccount(AGENT_KEY);
const agentWallet = createWalletClient({
  account: agentAccount,
  chain: foundry,
  transport: http(RPC_URL),
});

const solverAccount = privateKeyToAccount(SOLVER_KEY);
const solverWallet = createWalletClient({
  account: solverAccount,
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

function deployContracts(): {
  agentRegistry: Address;
  intentBook: Address;
  policyModule: Address;
} {
  const output = execSync(
    `forge script script/Deploy.s.sol --rpc-url ${RPC_URL} --broadcast --private-key ${DEPLOYER_KEY}`,
    { cwd: CONTRACTS_DIR, encoding: "utf-8", timeout: 30_000 },
  );

  const registryMatch = output.match(
    /AgentRegistry deployed at:\s+(0x[0-9a-fA-F]{40})/,
  );
  const intentMatch = output.match(
    /IntentBook deployed at:\s+(0x[0-9a-fA-F]{40})/,
  );
  const policyMatch = output.match(
    /PolicyModule deployed at:\s+(0x[0-9a-fA-F]{40})/,
  );

  if (!registryMatch || !intentMatch || !policyMatch) {
    throw new Error(`Failed to parse contract addresses from:\n${output}`);
  }

  return {
    agentRegistry: registryMatch[1] as Address,
    intentBook: intentMatch[1] as Address,
    policyModule: policyMatch[1] as Address,
  };
}

describe("Indexer integration", () => {
  beforeAll(async () => {
    // Start Anvil
    anvil = spawn("anvil", ["--port", "8545"], { stdio: "pipe" });
    anvil.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString();
      if (msg.includes("error") || msg.includes("Error")) {
        console.error("[anvil]", msg);
      }
    });

    await waitForAnvil();

    const addresses = deployContracts();
    agentRegistryAddress = addresses.agentRegistry;
    intentBookAddress = addresses.intentBook;
    policyModuleAddress = addresses.policyModule;
    console.log("Deployed:", addresses);

    // Setup Postgres test DB
    pool = new pg.Pool({ connectionString: TEST_DB_URL });

    // Drop and recreate tables for clean state
    await pool.query("DROP TABLE IF EXISTS fills, intents, agents, policies, tx_receipts, indexer_state CASCADE");
    await runMigrations(pool);
  }, 30_000);

  afterAll(async () => {
    if (pool) await pool.end();
    if (anvil) anvil.kill("SIGTERM");
  });

  it("should index agent registration", async () => {
    // Register an agent
    const { request } = await publicClient.simulateContract({
      address: agentRegistryAddress,
      abi: AgentRegistryABI,
      functionName: "registerAgent",
      args: ["ipfs://test-metadata", "0x1234", "0x0000000000000000000000000000000000000000000000000000000000000001"],
      account: agentAccount,
    });
    const txHash = await agentWallet.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Poll events
    const poller = new EventPoller(
      publicClient,
      pool,
      agentRegistryAddress,
      intentBookAddress,
      policyModuleAddress,
      0n,
    );
    await poller.poll();

    // Verify agents table
    const result = await pool.query("SELECT * FROM agents WHERE agent_id = 1");
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].owner).toBe(agentAccount.address.toLowerCase());
    expect(result.rows[0].metadata_uri).toBe("ipfs://test-metadata");
    expect(result.rows[0].revoked).toBe(false);
  });

  it("should index intent submit and fill", async () => {
    const block = await publicClient.getBlock();
    const deadline = block.timestamp + 3600n;

    // Submit intent
    const intent = {
      owner: agentAccount.address,
      intentType: 0, // SWAP_EXACT_IN_MAX_SLIPPAGE
      constraints: {
        amountInMax: 1000n,
        amountOutMin: 900n,
        deadline,
        slippageBps: 100,
      },
      inputToken: "0x0000000000000000000000000000000000000001" as Address,
      outputToken: "0x0000000000000000000000000000000000000002" as Address,
      nonce: 1n,
    };

    const [, , , chainId, verifyingContract] = await publicClient.readContract({
      address: intentBookAddress,
      abi: IntentBookABI,
      functionName: "eip712Domain",
    });

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
      message: intent,
    });

    const r = `0x${signature.slice(2, 66)}` as Hex;
    const s = `0x${signature.slice(66, 130)}` as Hex;
    const v = parseInt(signature.slice(130, 132), 16);

    const { request: submitReq } = await publicClient.simulateContract({
      address: intentBookAddress,
      abi: IntentBookABI,
      functionName: "submitIntent",
      args: [intent, v, r, s],
      account: agentAccount,
    });
    const submitTx = await agentWallet.writeContract(submitReq);
    const submitReceipt = await publicClient.waitForTransactionReceipt({ hash: submitTx });

    let intentId = 0n;
    for (const log of submitReceipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: IntentBookABI, data: log.data, topics: log.topics });
        if (decoded.eventName === "IntentSubmitted") {
          intentId = (decoded.args as { intentId: bigint }).intentId;
        }
      } catch { /* not matching */ }
    }
    expect(intentId).toBeGreaterThan(0n);

    // Fill intent
    const fill = {
      amountIn: 1000n,
      amountOut: 950n,
      solver: solverAccount.address,
      executionData: "0x" as Hex,
    };
    const { request: fillReq } = await publicClient.simulateContract({
      address: intentBookAddress,
      abi: IntentBookABI,
      functionName: "fillIntent",
      args: [intentId, fill],
      account: solverAccount,
    });
    const fillTx = await solverWallet.writeContract(fillReq);
    await publicClient.waitForTransactionReceipt({ hash: fillTx });

    // Poll events (fresh poller from block 0)
    const poller = new EventPoller(
      publicClient,
      pool,
      agentRegistryAddress,
      intentBookAddress,
      policyModuleAddress,
      0n,
    );
    await poller.poll();

    // Verify intents table
    const intentsResult = await pool.query(
      "SELECT * FROM intents WHERE intent_id = $1",
      [intentId.toString()],
    );
    expect(intentsResult.rows.length).toBe(1);
    expect(intentsResult.rows[0].status).toBe("FILLED");
    expect(intentsResult.rows[0].owner).toBe(agentAccount.address.toLowerCase());

    // Verify fills table
    const fillsResult = await pool.query(
      "SELECT * FROM fills WHERE intent_id = $1",
      [intentId.toString()],
    );
    expect(fillsResult.rows.length).toBe(1);
    expect(fillsResult.rows[0].solver).toBe(solverAccount.address.toLowerCase());
  });

  it("should index policy spend limit", async () => {
    // Set a spend limit
    const { request } = await publicClient.simulateContract({
      address: policyModuleAddress,
      abi: PolicyModuleABI,
      functionName: "setSpendLimit",
      args: [
        "0x0000000000000000000000000000000000000001" as Address,
        1000000n,
      ],
      account: agentAccount,
    });
    const txHash = await agentWallet.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Poll events
    const poller = new EventPoller(
      publicClient,
      pool,
      agentRegistryAddress,
      intentBookAddress,
      policyModuleAddress,
      0n,
    );
    await poller.poll();

    // Verify policies table
    const result = await pool.query(
      "SELECT * FROM policies WHERE account = $1 AND policy_type = 'spend_limit'",
      [agentAccount.address.toLowerCase()],
    );
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].value).toBe("1000000");
  });

  it("should track block state and not duplicate on re-poll", async () => {
    // Get current last processed block
    const lastBlock = await getLastProcessedBlock(pool);
    expect(lastBlock).not.toBeNull();

    // Count current rows
    const agentsBefore = await pool.query("SELECT count(*) FROM agents");
    const intentsBefore = await pool.query("SELECT count(*) FROM intents");

    // Re-poll from same start — should find no new events
    const poller = new EventPoller(
      publicClient,
      pool,
      agentRegistryAddress,
      intentBookAddress,
      policyModuleAddress,
      lastBlock! + 1n,
    );
    const count = await poller.poll();
    expect(count).toBe(0);

    // Row counts should be unchanged
    const agentsAfter = await pool.query("SELECT count(*) FROM agents");
    const intentsAfter = await pool.query("SELECT count(*) FROM intents");
    expect(agentsAfter.rows[0].count).toBe(agentsBefore.rows[0].count);
    expect(intentsAfter.rows[0].count).toBe(intentsBefore.rows[0].count);
  });
});
