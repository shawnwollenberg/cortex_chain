import {
  decodeEventLog,
  encodeAbiParameters,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";

export const IntentBookABI = [
  {
    type: "function",
    name: "submitIntent",
    inputs: [
      {
        name: "intent",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "intentType", type: "uint8" },
          {
            name: "constraints",
            type: "tuple",
            components: [
              { name: "amountInMax", type: "uint256" },
              { name: "amountOutMin", type: "uint256" },
              { name: "deadline", type: "uint256" },
              { name: "slippageBps", type: "uint16" },
            ],
          },
          {
            name: "execution",
            type: "tuple",
            components: [
              { name: "target", type: "address" },
              { name: "dataHash", type: "bytes32" },
              { name: "requiredAttestationSubject", type: "bytes32" },
              { name: "requiredAttestationSchema", type: "bytes32" },
              { name: "metadataURIHash", type: "bytes32" },
            ],
          },
          { name: "inputToken", type: "address" },
          { name: "outputToken", type: "address" },
          { name: "nonce", type: "uint256" },
        ],
      },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [{ name: "intentId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "submitBid",
    inputs: [
      { name: "intentId", type: "uint256" },
      { name: "amountIn", type: "uint256" },
      { name: "amountOut", type: "uint256" },
      { name: "fee", type: "uint256" },
      { name: "validUntil", type: "uint256" },
      { name: "executionHash", type: "bytes32" },
    ],
    outputs: [{ name: "bidId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "selectBid",
    inputs: [
      { name: "intentId", type: "uint256" },
      { name: "bidId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "IntentSubmitted",
    inputs: [
      { name: "intentId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "nonce", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

const CONSTRAINTS_TYPEHASH = keccak256(
  new TextEncoder().encode("Constraints(uint256 amountInMax,uint256 amountOutMin,uint256 deadline,uint16 slippageBps)"),
);
const EXECUTION_REQUIREMENTS_TYPEHASH = keccak256(
  new TextEncoder().encode("ExecutionRequirements(address target,bytes32 dataHash,bytes32 requiredAttestationSubject,bytes32 requiredAttestationSchema,bytes32 metadataURIHash)"),
);
const INTENT_TYPEHASH = keccak256(
  new TextEncoder().encode("Intent(address owner,uint8 intentType,Constraints constraints,ExecutionRequirements execution,address inputToken,address outputToken,uint256 nonce)Constraints(uint256 amountInMax,uint256 amountOutMin,uint256 deadline,uint16 slippageBps)ExecutionRequirements(address target,bytes32 dataHash,bytes32 requiredAttestationSubject,bytes32 requiredAttestationSchema,bytes32 metadataURIHash)"),
);

export interface AgentChainClientConfig {
  apiUrl: string;
  publicClient: {
    waitForTransactionReceipt(args: { hash: Hex }): Promise<{ logs: Array<{ data: Hex; topics: readonly Hex[] }> }>;
  };
  walletClient: {
    account?: { address: Address };
    signTypedData(args: Record<string, unknown>): Promise<Hex>;
    writeContract(args: Record<string, unknown>): Promise<Hex>;
  };
  intentBookAddress: Address;
  chain: { id: number };
}

export interface IntentConstraints {
  amountInMax: bigint;
  amountOutMin: bigint;
  deadline: bigint;
  slippageBps: number;
}

export interface AgentIntent {
  owner?: Address;
  intentType?: number;
  constraints: IntentConstraints;
  execution?: ExecutionRequirements;
  inputToken: Address;
  outputToken: Address;
  nonce: bigint;
}

export interface ExecutionRequirements {
  target: Address;
  dataHash: Hex;
  requiredAttestationSubject: Hex;
  requiredAttestationSchema: Hex;
  metadataURIHash: Hex;
}

export interface IntentMetadata {
  metadata_uri?: string;
  execution_target?: Address;
  execution_data?: Hex;
  required_attestation_subject?: Hex;
  required_attestation_schema?: Hex;
}

export interface PreflightRequest {
  account: Address;
  target: Address;
  value?: string;
  data?: Hex;
}

export interface CreateIntentRequest {
  intent: AgentIntent;
  metadata?: IntentMetadata;
  preflight?: PreflightRequest | false;
  waitForIndex?: boolean;
  indexTimeoutMs?: number;
}

export interface CreateIntentResult {
  intentId: bigint;
  intentHash: Hex;
  txHash: Hex;
  indexed: boolean;
  metadataReserved: boolean;
}

export interface SolverBidRequest {
  amountIn: bigint;
  amountOut: bigint;
  fee?: bigint;
  validUntil: bigint;
  executionHash?: Hex;
}

export class AgentChainClient {
  constructor(private readonly config: AgentChainClientConfig) {}

  async createIntent(request: CreateIntentRequest): Promise<CreateIntentResult> {
    const account = this.config.walletClient.account;
    if (!account) {
      throw new Error("walletClient must include an account");
    }

    const intent = {
      owner: request.intent.owner ?? account.address,
      intentType: request.intent.intentType ?? 0,
      constraints: request.intent.constraints,
      execution: request.intent.execution ?? executionFromMetadata(request.metadata),
      inputToken: request.intent.inputToken,
      outputToken: request.intent.outputToken,
      nonce: request.intent.nonce,
    };

    const intentHash = hashIntentStruct(intent);

    if (request.preflight) {
      const preflight = await this.postJson("/preflight", {
        account: request.preflight.account,
        target: request.preflight.target,
        value: request.preflight.value ?? "0",
        data: request.preflight.data ?? "0x",
      }) as { allowed?: boolean; reasons?: string[] };
      if (!preflight.allowed) {
        throw new Error(`Preflight denied: ${(preflight.reasons ?? []).join("; ") || "policy check failed"}`);
      }
    }

    let metadataReserved = false;
    if (request.metadata) {
      await this.postJson("/intents/metadata", {
        intent_hash: intentHash,
        owner: intent.owner,
        ...request.metadata,
      });
      metadataReserved = true;
    }

    const signature = await this.config.walletClient.signTypedData({
      account,
      domain: {
        name: "AgentIntentBook",
        version: "1",
        chainId: this.config.chain.id,
        verifyingContract: this.config.intentBookAddress,
      },
      types: INTENT_TYPES,
      primaryType: "Intent",
      message: intent,
    });
    const { v, r, s } = splitSignature(signature);

    const txHash = await this.config.walletClient.writeContract({
      account,
      chain: this.config.chain,
      address: this.config.intentBookAddress,
      abi: IntentBookABI,
      functionName: "submitIntent",
      args: [intent, v, r, s],
    });

    const receipt = await this.config.publicClient.waitForTransactionReceipt({ hash: txHash });
    const intentId = findIntentId(receipt.logs);

    let indexed = false;
    if (request.waitForIndex ?? true) {
      indexed = await this.waitForIndexedIntent(intentId, request.indexTimeoutMs ?? 30_000);
      if (indexed && request.metadata) {
        await this.putJson(`/intents/${intentId}/metadata`, request.metadata);
      }
    }

    return { intentId, intentHash, txHash, indexed, metadataReserved };
  }

  async submitBid(intentId: bigint, bid: SolverBidRequest): Promise<Hex> {
    const account = this.config.walletClient.account;
    if (!account) throw new Error("walletClient must include an account");
    return this.config.walletClient.writeContract({
      account,
      chain: this.config.chain,
      address: this.config.intentBookAddress,
      abi: IntentBookABI,
      functionName: "submitBid",
      args: [
        intentId,
        bid.amountIn,
        bid.amountOut,
        bid.fee ?? 0n,
        bid.validUntil,
        bid.executionHash ?? "0x0000000000000000000000000000000000000000000000000000000000000000",
      ],
    });
  }

  async listBids(intentId: bigint, status?: string): Promise<unknown> {
    const params = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await fetch(`${this.config.apiUrl}/intents/${intentId}/bids${params}`);
    if (!res.ok) throw new Error(`GET /intents/${intentId}/bids failed`);
    return res.json();
  }

  async selectBid(intentId: bigint, bidId: bigint): Promise<Hex> {
    const account = this.config.walletClient.account;
    if (!account) throw new Error("walletClient must include an account");
    return this.config.walletClient.writeContract({
      account,
      chain: this.config.chain,
      address: this.config.intentBookAddress,
      abi: IntentBookABI,
      functionName: "selectBid",
      args: [intentId, bidId],
    });
  }

  async listAttestationSchemas(): Promise<unknown> {
    const res = await fetch(`${this.config.apiUrl}/attestations/schemas`);
    if (!res.ok) throw new Error("GET /attestations/schemas failed");
    return res.json();
  }

  private async waitForIndexedIntent(intentId: bigint, timeoutMs: number): Promise<boolean> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const res = await fetch(`${this.config.apiUrl}/intents/${intentId}`);
      if (res.ok) return true;
      await sleep(1_000);
    }
    return false;
  }

  private async postJson(path: string, body: unknown): Promise<unknown> {
    return this.requestJson("POST", path, body);
  }

  private async putJson(path: string, body: unknown): Promise<unknown> {
    return this.requestJson("PUT", path, body);
  }

  private async requestJson(method: "POST" | "PUT", path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body, bigintJsonReplacer),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const error = isErrorPayload(payload) ? payload.error : `${method} ${path} failed`;
      throw new Error(error);
    }
    return payload;
  }
}

export function hashIntentStruct(intent: Required<AgentIntent>): Hex {
  const constraintsHash = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint16" },
      ],
      [
        CONSTRAINTS_TYPEHASH,
        intent.constraints.amountInMax,
        intent.constraints.amountOutMin,
        intent.constraints.deadline,
        intent.constraints.slippageBps,
      ],
    ),
  );
  const executionHash = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "address" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
      ],
      [
        EXECUTION_REQUIREMENTS_TYPEHASH,
        intent.execution.target,
        intent.execution.dataHash,
        intent.execution.requiredAttestationSubject,
        intent.execution.requiredAttestationSchema,
        intent.execution.metadataURIHash,
      ],
    ),
  );

  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "address" },
        { type: "uint8" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
      ],
      [
        INTENT_TYPEHASH,
        intent.owner,
        intent.intentType,
        constraintsHash,
        executionHash,
        intent.inputToken,
        intent.outputToken,
        intent.nonce,
      ],
    ),
  );
}

function splitSignature(signature: Hex): { v: number; r: Hex; s: Hex } {
  return {
    r: `0x${signature.slice(2, 66)}`,
    s: `0x${signature.slice(66, 130)}`,
    v: parseInt(signature.slice(130, 132), 16),
  };
}

function findIntentId(logs: Array<{ data: Hex; topics: readonly Hex[] }>): bigint {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: IntentBookABI,
        data: log.data,
        topics: [...log.topics] as [] | [Hex, ...Hex[]],
      });
      if (decoded.eventName === "IntentSubmitted") {
        return decoded.args.intentId;
      }
    } catch {
      // Ignore unrelated logs.
    }
  }
  throw new Error("IntentSubmitted event not found in transaction receipt");
}

function bigintJsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function executionFromMetadata(metadata?: IntentMetadata): ExecutionRequirements {
  return {
    target: metadata?.execution_target ?? "0x0000000000000000000000000000000000000000",
    dataHash: metadata?.execution_data ? keccak256(metadata.execution_data) : "0x0000000000000000000000000000000000000000000000000000000000000000",
    requiredAttestationSubject: metadata?.required_attestation_subject ?? "0x0000000000000000000000000000000000000000000000000000000000000000",
    requiredAttestationSchema: metadata?.required_attestation_schema ?? "0x0000000000000000000000000000000000000000000000000000000000000000",
    metadataURIHash: metadata?.metadata_uri
      ? keccak256(stringToHex(metadata.metadata_uri))
      : "0x0000000000000000000000000000000000000000000000000000000000000000",
  };
}

function isErrorPayload(payload: unknown): payload is { error: string } {
  return typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error: unknown }).error === "string";
}

const INTENT_TYPES = {
  Intent: [
    { name: "owner", type: "address" },
    { name: "intentType", type: "uint8" },
    { name: "constraints", type: "Constraints" },
    { name: "execution", type: "ExecutionRequirements" },
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
  ExecutionRequirements: [
    { name: "target", type: "address" },
    { name: "dataHash", type: "bytes32" },
    { name: "requiredAttestationSubject", type: "bytes32" },
    { name: "requiredAttestationSchema", type: "bytes32" },
    { name: "metadataURIHash", type: "bytes32" },
  ],
} as const;
