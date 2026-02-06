import type { PublicClient, WalletClient, Address } from "viem";
import { IntentBookABI } from "./abi/IntentBook.js";
import { IntentStatus, type Intent, type Fill } from "./types.js";
import { validateIntentConstraints } from "./validator.js";
import { logger } from "./logger.js";

export class IntentExecutor {
  constructor(
    private publicClient: PublicClient,
    private walletClient: WalletClient,
    private intentBookAddress: Address,
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

      // 4. Construct fill at constraint boundaries
      const solverAddress = this.walletClient.account!.address;
      const fill: Fill = {
        amountIn: intent.constraints.amountInMax,
        amountOut: intent.constraints.amountOutMin,
        solver: solverAddress,
        executionData: "0x",
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
}
