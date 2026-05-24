import "dotenv/config";
import { isAddress, type Address } from "viem";

export interface IndexerConfig {
  rpcUrl: string;
  databaseUrl: string;
  agentRegistryAddress: Address;
  intentBookAddress: Address;
  policyModuleAddress: Address;
  attestationRegistryAddress: Address | null;
  solverRegistryAddress: Address | null;
  attestorRegistryAddress: Address | null;
  commerceRegistryAddress: Address | null;
  pollIntervalMs: number;
  startBlock: bigint;
  logLevel: "debug" | "info" | "warn" | "error";
}

export function loadConfig(): IndexerConfig {
  const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const agentRegistryAddress = process.env.AGENT_REGISTRY_ADDRESS;
  if (!agentRegistryAddress) {
    throw new Error("AGENT_REGISTRY_ADDRESS is required");
  }
  if (!isAddress(agentRegistryAddress)) {
    throw new Error("AGENT_REGISTRY_ADDRESS is not a valid address");
  }

  const intentBookAddress = process.env.INTENT_BOOK_ADDRESS;
  if (!intentBookAddress) {
    throw new Error("INTENT_BOOK_ADDRESS is required");
  }
  if (!isAddress(intentBookAddress)) {
    throw new Error("INTENT_BOOK_ADDRESS is not a valid address");
  }

  const policyModuleAddress = process.env.POLICY_MODULE_ADDRESS;
  if (!policyModuleAddress) {
    throw new Error("POLICY_MODULE_ADDRESS is required");
  }
  if (!isAddress(policyModuleAddress)) {
    throw new Error("POLICY_MODULE_ADDRESS is not a valid address");
  }

  let attestationRegistryAddress: Address | null = null;
  const attestationRegistryEnv = process.env.ATTESTATION_REGISTRY_ADDRESS;
  if (attestationRegistryEnv) {
    if (!isAddress(attestationRegistryEnv)) {
      throw new Error("ATTESTATION_REGISTRY_ADDRESS is not a valid address");
    }
    attestationRegistryAddress = attestationRegistryEnv as Address;
  }

  let solverRegistryAddress: Address | null = null;
  const solverRegistryEnv = process.env.SOLVER_REGISTRY_ADDRESS;
  if (solverRegistryEnv) {
    if (!isAddress(solverRegistryEnv)) {
      throw new Error("SOLVER_REGISTRY_ADDRESS is not a valid address");
    }
    solverRegistryAddress = solverRegistryEnv as Address;
  }

  let attestorRegistryAddress: Address | null = null;
  const attestorRegistryEnv = process.env.ATTESTOR_REGISTRY_ADDRESS;
  if (attestorRegistryEnv) {
    if (!isAddress(attestorRegistryEnv)) {
      throw new Error("ATTESTOR_REGISTRY_ADDRESS is not a valid address");
    }
    attestorRegistryAddress = attestorRegistryEnv as Address;
  }

  let commerceRegistryAddress: Address | null = null;
  const commerceRegistryEnv = process.env.COMMERCE_REGISTRY_ADDRESS;
  if (commerceRegistryEnv) {
    if (!isAddress(commerceRegistryEnv)) {
      throw new Error("COMMERCE_REGISTRY_ADDRESS is not a valid address");
    }
    commerceRegistryAddress = commerceRegistryEnv as Address;
  }

  const pollIntervalMs = parseInt(process.env.POLL_INTERVAL_MS ?? "2000", 10);
  if (isNaN(pollIntervalMs) || pollIntervalMs < 100) {
    throw new Error("POLL_INTERVAL_MS must be a number >= 100");
  }

  const startBlock = BigInt(process.env.START_BLOCK ?? "0");

  const logLevel = (process.env.LOG_LEVEL ?? "info") as IndexerConfig["logLevel"];
  if (!["debug", "info", "warn", "error"].includes(logLevel)) {
    throw new Error("LOG_LEVEL must be one of: debug, info, warn, error");
  }

  return {
    rpcUrl,
    databaseUrl,
    agentRegistryAddress: agentRegistryAddress as Address,
    intentBookAddress: intentBookAddress as Address,
    policyModuleAddress: policyModuleAddress as Address,
    attestationRegistryAddress,
    solverRegistryAddress,
    attestorRegistryAddress,
    commerceRegistryAddress,
    pollIntervalMs,
    startBlock,
    logLevel,
  };
}
