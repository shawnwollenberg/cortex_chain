import type { PublicClient, Address } from "viem";
import { parseAbiItem } from "viem";
import type { IntentSubmittedEvent } from "./types.js";
import { logger } from "./logger.js";

const INTENT_SUBMITTED_EVENT = parseAbiItem(
  "event IntentSubmitted(uint256 indexed intentId, address indexed owner, uint256 nonce)",
);

export class IntentListener {
  private lastProcessedBlock: bigint;

  constructor(
    private client: PublicClient,
    private intentBookAddress: Address,
    startBlock: bigint,
  ) {
    // We'll start polling from startBlock (inclusive)
    this.lastProcessedBlock = startBlock - 1n;
  }

  async pollForEvents(): Promise<IntentSubmittedEvent[]> {
    try {
      const currentBlock = await this.client.getBlockNumber();
      const fromBlock = this.lastProcessedBlock + 1n;

      if (fromBlock > currentBlock) {
        logger.debug(`No new blocks (current=${currentBlock})`);
        return [];
      }

      logger.debug(`Polling blocks ${fromBlock}–${currentBlock}`);

      const logs = await this.client.getLogs({
        address: this.intentBookAddress,
        event: INTENT_SUBMITTED_EVENT,
        fromBlock,
        toBlock: currentBlock,
      });

      this.lastProcessedBlock = currentBlock;

      const events: IntentSubmittedEvent[] = logs.map((log) => ({
        intentId: log.args.intentId!,
        owner: log.args.owner!,
        nonce: log.args.nonce!,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      }));

      if (events.length > 0) {
        logger.info(`Found ${events.length} IntentSubmitted event(s)`);
      }

      return events;
    } catch (err) {
      logger.error("Error polling for events:", err);
      return [];
    }
  }
}
