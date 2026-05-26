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

export const CommerceRegistryABI = [
  {
    type: "function",
    name: "computeQuoteHash",
    inputs: [
      { name: "merchantId", type: "uint256" },
      { name: "serviceNumericId", type: "uint256" },
      { name: "agent", type: "address" },
      { name: "token", type: "address" },
      { name: "facilitator", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "paymentRail", type: "uint8" },
      { name: "expiresAt", type: "uint256" },
      { name: "paymentNonce", type: "uint256" },
      { name: "resourceHash", type: "bytes32" },
      { name: "termsHash", type: "bytes32" },
      { name: "x402PayloadHash", type: "bytes32" },
    ],
    outputs: [{ name: "quoteHash", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "commitQuote",
    inputs: [
      {
        name: "commitment",
        type: "tuple",
        components: [
          { name: "merchantId", type: "uint256" },
          { name: "serviceNumericId", type: "uint256" },
          { name: "agent", type: "address" },
          { name: "token", type: "address" },
          { name: "facilitator", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "paymentRail", type: "uint8" },
          { name: "expiresAt", type: "uint256" },
          { name: "paymentNonce", type: "uint256" },
          { name: "resourceHash", type: "bytes32" },
          { name: "termsHash", type: "bytes32" },
          { name: "x402PayloadHash", type: "bytes32" },
        ],
      },
    ],
    outputs: [{ name: "quoteHash", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "recordReceipt",
    inputs: [
      { name: "quoteHash", type: "bytes32" },
      { name: "resultHash", type: "bytes32" },
    ],
    outputs: [{ name: "receiptId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "recordFulfillment",
    inputs: [
      { name: "receiptId", type: "uint256" },
      { name: "fulfillmentHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "openDispute",
    inputs: [
      { name: "receiptId", type: "uint256" },
      { name: "reasonHash", type: "bytes32" },
    ],
    outputs: [{ name: "disputeId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resolveDispute",
    inputs: [
      { name: "disputeId", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "resolutionHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const PolicyModuleABI = [
  {
    type: "function",
    name: "setSignedPaymentPolicy",
    inputs: [
      { name: "merchant", type: "address" },
      { name: "token", type: "address" },
      { name: "facilitator", type: "address" },
      { name: "maxPerPayment", type: "uint256" },
      { name: "maxPerDay", type: "uint256" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "recordSignedPayment",
    inputs: [
      { name: "merchant", type: "address" },
      { name: "token", type: "address" },
      { name: "facilitator", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "paymentHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const ERC20ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "success", type: "bool" }],
    stateMutability: "nonpayable",
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
    readContract(args: Record<string, unknown>): Promise<unknown>;
    waitForTransactionReceipt(args: { hash: Hex }): Promise<{ logs: Array<{ data: Hex; topics?: readonly Hex[] }> }>;
  };
  walletClient: {
    account?: { address: Address };
    signTypedData(args: Record<string, unknown>): Promise<Hex>;
    writeContract(args: Record<string, unknown>): Promise<Hex>;
  };
  intentBookAddress: Address;
  commerceRegistryAddress?: Address;
  policyModuleAddress?: Address;
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

export enum PaymentRail {
  Transfer = 0,
  Swap = 1,
  Facilitator = 2,
  X402 = 3,
}

export enum SignalSubject {
  Merchant = 0,
  Service = 1,
  Facilitator = 2,
  Agent = 3,
}

export enum SignalKind {
  Verification = 0,
  Risk = 1,
  Compliance = 2,
  Fulfillment = 3,
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface MerchantQuery extends PaginationParams {
  owner?: Address;
  active?: boolean;
}

export interface ServiceQuery extends PaginationParams {
  merchant_id?: string | bigint;
  capability_hash?: Hex;
  active?: boolean;
}

export interface ReceiptQuery extends PaginationParams {
  agent?: Address;
  merchant_id?: string | bigint;
}

export interface TrustSignalQuery extends PaginationParams {
  subject_type?: SignalSubject | number;
  subject_id?: string | bigint;
  kind?: SignalKind | number;
  reporter?: Address;
}

export interface QuoteCommitment {
  merchantId: bigint;
  serviceNumericId: bigint;
  agent: Address;
  token: Address;
  facilitator: Address;
  amount: bigint;
  paymentRail: PaymentRail | number;
  expiresAt: bigint;
  paymentNonce: bigint;
  resourceHash: Hex;
  termsHash: Hex;
  x402PayloadHash: Hex;
}

export interface SignedPaymentPolicy {
  merchant: Address;
  token: Address;
  facilitator: Address;
  maxPerPayment: bigint;
  maxPerDay: bigint;
  allowed?: boolean;
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
    return this.getJson("/attestations/schemas");
  }

  async listMerchants(query: MerchantQuery = {}): Promise<unknown> {
    return this.getJson(`/merchants${toQueryString(query)}`);
  }

  async getMerchant(merchantId: string | bigint): Promise<unknown> {
    return this.getJson(`/merchants/${merchantId}`);
  }

  async getMerchantReputation(merchantId: string | bigint): Promise<unknown> {
    return this.getJson(`/merchants/${merchantId}/reputation`);
  }

  async listServices(query: ServiceQuery = {}): Promise<unknown> {
    return this.getJson(`/services${toQueryString(query)}`);
  }

  async listReceipts(query: ReceiptQuery = {}): Promise<unknown> {
    return this.getJson(`/receipts${toQueryString(query)}`);
  }

  async listTrustSignals(query: TrustSignalQuery = {}): Promise<unknown> {
    return this.getJson(`/trust-signals${toQueryString(query)}`);
  }

  async getCommerceAnalytics(): Promise<unknown> {
    return this.getJson("/analytics/commerce");
  }

  async computeQuoteHash(quote: QuoteCommitment): Promise<Hex> {
    const commerceRegistryAddress = this.requireCommerceRegistryAddress();
    return await this.config.publicClient.readContract({
      address: commerceRegistryAddress,
      abi: CommerceRegistryABI,
      functionName: "computeQuoteHash",
      args: quoteArgs(quote),
    }) as Hex;
  }

  async commitQuote(quote: QuoteCommitment): Promise<Hex> {
    const account = this.requireAccount();
    return this.config.walletClient.writeContract({
      account,
      chain: this.config.chain,
      address: this.requireCommerceRegistryAddress(),
      abi: CommerceRegistryABI,
      functionName: "commitQuote",
      args: [quote],
    });
  }

  async recordReceipt(quoteHash: Hex, resultHash: Hex): Promise<Hex> {
    const account = this.requireAccount();
    return this.config.walletClient.writeContract({
      account,
      chain: this.config.chain,
      address: this.requireCommerceRegistryAddress(),
      abi: CommerceRegistryABI,
      functionName: "recordReceipt",
      args: [quoteHash, resultHash],
    });
  }

  async recordFulfillment(receiptId: bigint, fulfillmentHash: Hex): Promise<Hex> {
    const account = this.requireAccount();
    return this.config.walletClient.writeContract({
      account,
      chain: this.config.chain,
      address: this.requireCommerceRegistryAddress(),
      abi: CommerceRegistryABI,
      functionName: "recordFulfillment",
      args: [receiptId, fulfillmentHash],
    });
  }

  async openDispute(receiptId: bigint, reasonHash: Hex): Promise<Hex> {
    const account = this.requireAccount();
    return this.config.walletClient.writeContract({
      account,
      chain: this.config.chain,
      address: this.requireCommerceRegistryAddress(),
      abi: CommerceRegistryABI,
      functionName: "openDispute",
      args: [receiptId, reasonHash],
    });
  }

  async resolveDispute(disputeId: bigint, status: 1 | 2, resolutionHash: Hex): Promise<Hex> {
    const account = this.requireAccount();
    return this.config.walletClient.writeContract({
      account,
      chain: this.config.chain,
      address: this.requireCommerceRegistryAddress(),
      abi: CommerceRegistryABI,
      functionName: "resolveDispute",
      args: [disputeId, status, resolutionHash],
    });
  }

  async setSignedPaymentPolicy(policy: SignedPaymentPolicy): Promise<Hex> {
    const account = this.requireAccount();
    return this.config.walletClient.writeContract({
      account,
      chain: this.config.chain,
      address: this.requirePolicyModuleAddress(),
      abi: PolicyModuleABI,
      functionName: "setSignedPaymentPolicy",
      args: [
        policy.merchant,
        policy.token,
        policy.facilitator,
        policy.maxPerPayment,
        policy.maxPerDay,
        policy.allowed ?? true,
      ],
    });
  }

  async recordSignedPayment(
    merchant: Address,
    token: Address,
    facilitator: Address,
    amount: bigint,
    paymentHash: Hex,
  ): Promise<Hex> {
    const account = this.requireAccount();
    return this.config.walletClient.writeContract({
      account,
      chain: this.config.chain,
      address: this.requirePolicyModuleAddress(),
      abi: PolicyModuleABI,
      functionName: "recordSignedPayment",
      args: [merchant, token, facilitator, amount, paymentHash],
    });
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

  private async getJson(path: string): Promise<unknown> {
    const res = await fetch(`${this.config.apiUrl}${path}`);
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const error = isErrorPayload(payload) ? payload.error : `GET ${path} failed`;
      throw new Error(error);
    }
    return payload;
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

  private requireAccount(): { address: Address } {
    const account = this.config.walletClient.account;
    if (!account) throw new Error("walletClient must include an account");
    return account;
  }

  private requireCommerceRegistryAddress(): Address {
    const address = this.config.commerceRegistryAddress;
    if (!address) throw new Error("commerceRegistryAddress is required for commerce writes");
    return address;
  }

  private requirePolicyModuleAddress(): Address {
    const address = this.config.policyModuleAddress;
    if (!address) throw new Error("policyModuleAddress is required for policy writes");
    return address;
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

function findIntentId(logs: Array<{ data: Hex; topics?: readonly Hex[] }>): bigint {
  for (const log of logs) {
    if (!log.topics) continue;
    try {
      const decoded = decodeEventLog({
        abi: IntentBookABI,
        data: log.data,
        topics: [...log.topics] as [] | [Hex, ...Hex[]],
      }) as { eventName?: string; args?: { intentId?: bigint } };
      if (decoded.eventName === "IntentSubmitted") {
        if (typeof decoded.args?.intentId === "bigint") return decoded.args.intentId;
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

function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    search.set(key, typeof value === "bigint" ? value.toString() : String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
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

function quoteArgs(quote: QuoteCommitment) {
  return [
    quote.merchantId,
    quote.serviceNumericId,
    quote.agent,
    quote.token,
    quote.facilitator,
    quote.amount,
    quote.paymentRail,
    quote.expiresAt,
    quote.paymentNonce,
    quote.resourceHash,
    quote.termsHash,
    quote.x402PayloadHash,
  ] as const;
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
