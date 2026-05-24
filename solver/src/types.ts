import type { Address, Hash, Hex } from "viem";

export enum IntentStatus {
  OPEN = 0,
  FILLED = 1,
  CANCELLED = 2,
  EXPIRED = 3,
}

export enum IntentType {
  SWAP_EXACT_IN_MAX_SLIPPAGE = 0,
}

export interface Constraints {
  amountInMax: bigint;
  amountOutMin: bigint;
  deadline: bigint;
  slippageBps: number;
}

export interface Intent {
  owner: Address;
  intentType: IntentType;
  constraints: Constraints;
  execution: {
    target: Address;
    dataHash: Hex;
    requiredAttestationSubject: Hex;
    requiredAttestationSchema: Hex;
    metadataURIHash: Hex;
  };
  inputToken: Address;
  outputToken: Address;
  nonce: bigint;
}

export interface Fill {
  amountIn: bigint;
  amountOut: bigint;
  solver: Address;
  executionData: Hex;
  resultHash: Hex;
  traceHash: Hex;
  attestationId: bigint;
}

export interface IntentSubmittedEvent {
  intentId: bigint;
  owner: Address;
  nonce: bigint;
  blockNumber: bigint;
  transactionHash: Hash;
}
