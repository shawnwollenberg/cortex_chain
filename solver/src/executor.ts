import type { PublicClient, WalletClient, Address, Hex } from "viem";
import { encodeAbiParameters, keccak256 } from "viem";
import { IntentBookABI } from "./abi/IntentBook.js";
import { IntentStatus, type Intent, type Fill } from "./types.js";
import { validateIntentConstraints } from "./validator.js";
import { logger } from "./logger.js";

export class IntentExecutor {
  constructor(
    private publicClient: PublicClient,
    private walletClient: WalletClient,
    private intentBookAddress: Address,
    private apiUrl: string | null = null,
  ) {}

  async processIntent(intentId: bigint): Promise<boolean> {
    try {
      // 1. Check status
      const status = await this.publicClient.readContract({
        address: this.intentBookAddress,
        abi: IntentBookABI,
        functionName: "getIntentStatus",
        args: [intentId],
      });

      if (status !== IntentStatus.OPEN) {
        logger.info(
          `Intent ${intentId}: skipping (status=${IntentStatus[status] ?? status})`,
        );
        return false;
      }

      // 2. Fetch intent
      const raw = await this.publicClient.readContract({
        address: this.intentBookAddress,
        abi: IntentBookABI,
        functionName: "getIntent",
        args: [intentId],
      });

      const intent: Intent = {
        owner: raw.owner,
        intentType: raw.intentType,
        constraints: {
          amountInMax: raw.constraints.amountInMax,
          amountOutMin: raw.constraints.amountOutMin,
          deadline: raw.constraints.deadline,
          slippageBps: raw.constraints.slippageBps,
        },
        execution: {
          target: raw.execution.target,
          dataHash: raw.execution.dataHash,
          requiredAttestationSubject: raw.execution.requiredAttestationSubject,
          requiredAttestationSchema: raw.execution.requiredAttestationSchema,
          metadataURIHash: raw.execution.metadataURIHash,
        },
        inputToken: raw.inputToken,
        outputToken: raw.outputToken,
        nonce: raw.nonce,
      };

      // 3. Validate constraints offchain
      const validation = validateIntentConstraints(intent);
      if (!validation.valid) {
        logger.info(`Intent ${intentId}: skipping (${validation.reason})`);
        return false;
      }

      const selectedBidId = await this.publicClient.readContract({
        address: this.intentBookAddress,
        abi: IntentBookABI,
        functionName: "getSelectedBid",
        args: [intentId],
      });
      let bidAmounts: { amountIn: bigint; amountOut: bigint } | null = null;
      if (selectedBidId === 0n) {
        logger.info(`Intent ${intentId}: submitting onchain bid`);
        const { request } = await this.publicClient.simulateContract({
          address: this.intentBookAddress,
          abi: IntentBookABI,
          functionName: "submitBid",
          args: [
            intentId,
            intent.constraints.amountInMax,
            intent.constraints.amountOutMin,
            0n,
            intent.constraints.deadline,
            intent.execution.dataHash,
          ],
          account: this.walletClient.account!,
        });
        const bidTx = await this.walletClient.writeContract(request);
        await this.publicClient.waitForTransactionReceipt({ hash: bidTx });
        logger.info(`Intent ${intentId}: bid submitted in tx ${bidTx}`);
        return false;
      } else {
        const bid = await this.publicClient.readContract({
          address: this.intentBookAddress,
          abi: IntentBookABI,
          functionName: "getBid",
          args: [intentId, selectedBidId],
        });
        const solverAddress = this.walletClient.account!.address;
        if (bid.solver.toLowerCase() !== solverAddress.toLowerCase()) {
          logger.info(`Intent ${intentId}: skipping (selected bid belongs to ${bid.solver})`);
          return false;
        }
        bidAmounts = { amountIn: bid.amountIn, amountOut: bid.amountOut };
      }

      const metadata = await this.getIntentMetadata(intentId);
      const requiredAttestation = {
        required_attestation_subject: zeroToNull(intent.execution.requiredAttestationSubject) ?? metadata?.required_attestation_subject ?? null,
        required_attestation_schema: zeroToNull(intent.execution.requiredAttestationSchema) ?? metadata?.required_attestation_schema ?? null,
      };
      let attestationId = 0n;
      if (requiredAttestation.required_attestation_subject || requiredAttestation.required_attestation_schema) {
        attestationId = await this.findRequiredAttestation(requiredAttestation);
        if (attestationId === 0n) {
          logger.info(`Intent ${intentId}: skipping (required attestation missing)`);
          return false;
        }
      }

      let executionTxHash: Hex = "0x";
      if (metadata?.execution_target && metadata.execution_data) {
        logger.info(`Intent ${intentId}: executing plan target=${metadata.execution_target}`);
        await this.publicClient.call({
          account: this.walletClient.account!.address,
          to: metadata.execution_target,
          data: metadata.execution_data,
        });
        executionTxHash = await this.walletClient.sendTransaction({
          account: this.walletClient.account!,
          chain: undefined,
          to: metadata.execution_target,
          data: metadata.execution_data,
        });
        await this.publicClient.waitForTransactionReceipt({ hash: executionTxHash });
      }

      // 4. Construct fill at constraint boundaries
      const solverAddress = this.walletClient.account!.address;
      const fill: Fill = {
        amountIn: bidAmounts?.amountIn ?? intent.constraints.amountInMax,
        amountOut: bidAmounts?.amountOut ?? intent.constraints.amountOutMin,
        solver: solverAddress,
        executionData: encodeExecutionData(metadata, executionTxHash),
        resultHash: executionTxHash === "0x" ? "0x0000000000000000000000000000000000000000000000000000000000000000" : executionTxHash,
        traceHash: metadata?.execution_data ? keccak256(metadata.execution_data) : "0x0000000000000000000000000000000000000000000000000000000000000000",
        attestationId,
      };

      logger.info(
        `Intent ${intentId}: filling (amountIn=${fill.amountIn}, amountOut=${fill.amountOut})`,
      );

      // 5. Simulate
      const { request } = await this.publicClient.simulateContract({
        address: this.intentBookAddress,
        abi: IntentBookABI,
        functionName: "fillIntent",
        args: [intentId, fill],
        account: this.walletClient.account!,
      });

      // 6. Execute
      const txHash = await this.walletClient.writeContract(request);
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      if (receipt.status === "success") {
        logger.info(`Intent ${intentId}: filled in tx ${txHash}`);
        return true;
      } else {
        logger.error(`Intent ${intentId}: tx reverted ${txHash}`);
        return false;
      }
    } catch (err) {
      logger.error(`Intent ${intentId}: processing failed:`, err);
      return false;
    }
  }

  private async getIntentMetadata(intentId: bigint): Promise<IntentMetadata | null> {
    if (!this.apiUrl) return null;
    try {
      const res = await fetch(`${this.apiUrl}/intents/${intentId}`);
      if (!res.ok) return null;
      const body = await res.json() as { metadata?: IntentMetadata | null };
      return body.metadata ?? null;
    } catch (err) {
      logger.warn(`Intent ${intentId}: metadata lookup failed`, err);
      return null;
    }
  }

  private async findRequiredAttestation(metadata: {
    required_attestation_subject: Hex | null;
    required_attestation_schema: Hex | null;
  }): Promise<bigint> {
    if (!this.apiUrl || (!metadata.required_attestation_subject && !metadata.required_attestation_schema)) return 0n;
    const params = new URLSearchParams();
    if (metadata.required_attestation_subject) {
      params.set("subject", metadata.required_attestation_subject);
    }
    if (metadata.required_attestation_schema) {
      params.set("schema", metadata.required_attestation_schema);
    }
    const res = await fetch(`${this.apiUrl}/attestations?${params}`);
    if (!res.ok) return 0n;
    const body = await res.json() as { attestations?: Array<{ attestation_id: string; revoked: boolean }> };
    const attestation = (body.attestations ?? []).find((item) => !item.revoked);
    return attestation ? BigInt(attestation.attestation_id) : 0n;
  }
}

interface IntentMetadata {
  execution_target: Address | null;
  execution_data: Hex | null;
  required_attestation_subject: Hex | null;
  required_attestation_schema: Hex | null;
}

function zeroToNull(value: Hex): Hex | null {
  return value === "0x0000000000000000000000000000000000000000000000000000000000000000" ? null : value;
}

function encodeExecutionData(metadata: IntentMetadata | null, executionTxHash: Hex): Hex {
  if (!metadata && executionTxHash === "0x") return "0x";
  return encodeAbiParameters(
    [
      { type: "bytes32" },
      { type: "address" },
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "bytes32" },
    ],
    [
      executionTxHash === "0x" ? "0x0000000000000000000000000000000000000000000000000000000000000000" : executionTxHash,
      metadata?.execution_target ?? "0x0000000000000000000000000000000000000000",
      metadata?.execution_data ? keccak256(metadata.execution_data) : "0x0000000000000000000000000000000000000000000000000000000000000000",
      metadata?.required_attestation_subject ?? "0x0000000000000000000000000000000000000000000000000000000000000000",
      metadata?.required_attestation_schema ?? "0x0000000000000000000000000000000000000000000000000000000000000000",
    ],
  );
}
