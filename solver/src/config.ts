import "dotenv/config";
import { isAddress, type Address, type Hex } from "viem";

export interface SolverConfig {
  rpcUrl: string;
  solverPrivateKey: Hex;
  intentBookAddress: Address;
  pollIntervalMs: number;
  startBlock: bigint | "latest";
  logLevel: "debug" | "info" | "warn" | "error";
}

export function loadConfig(): SolverConfig {
  const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";

  const solverPrivateKey = process.env.SOLVER_PRIVATE_KEY;
  if (!solverPrivateKey) {
    throw new Error("SOLVER_PRIVATE_KEY is required");
  }
  if (!solverPrivateKey.startsWith("0x")) {
    throw new Error("SOLVER_PRIVATE_KEY must be 0x-prefixed");
  }

  const intentBookAddress = process.env.INTENT_BOOK_ADDRESS;
  if (!intentBookAddress) {
    throw new Error("INTENT_BOOK_ADDRESS is required");
  }
  if (!isAddress(intentBookAddress)) {
    throw new Error("INTENT_BOOK_ADDRESS is not a valid address");
  }

  const pollIntervalMs = parseInt(process.env.POLL_INTERVAL_MS ?? "2000", 10);
  if (isNaN(pollIntervalMs) || pollIntervalMs < 100) {
    throw new Error("POLL_INTERVAL_MS must be a number >= 100");
  }

  const startBlockRaw = process.env.START_BLOCK ?? "latest";
  const startBlock =
    startBlockRaw === "latest" ? "latest" as const : BigInt(startBlockRaw);

  const logLevel = (process.env.LOG_LEVEL ?? "info") as SolverConfig["logLevel"];
  if (!["debug", "info", "warn", "error"].includes(logLevel)) {
    throw new Error("LOG_LEVEL must be one of: debug, info, warn, error");
  }

  return {
    rpcUrl,
    solverPrivateKey: solverPrivateKey as Hex,
    intentBookAddress: intentBookAddress as Address,
    pollIntervalMs,
    startBlock,
    logLevel,
  };
}
