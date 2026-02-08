import type { PublicClient, Address, Log } from "viem";
import { decodeEventLog } from "viem";
import type pg from "pg";
import { AgentRegistryABI } from "./abi/AgentRegistry.js";
import { IntentBookABI } from "./abi/IntentBook.js";
import { PolicyModuleABI } from "./abi/PolicyModule.js";
import { AttestationRegistryABI } from "./abi/AttestationRegistry.js";
import {
  handleAgentRegistered,
  handleAgentUpdated,
  handleAgentRevoked,
} from "./handlers/agents.js";
import {
  handleIntentSubmitted,
  handleIntentFilled,
  handleIntentCancelled,
} from "./handlers/intents.js";
import {
  handleSpendLimitSet,
  handleTargetAllowlistUpdated,
  handleFunctionAllowlistUpdated,
  handleSpendRecorded,
} from "./handlers/policies.js";
import {
  handleAttestationSubmitted,
  handleAttestationRevoked,
} from "./handlers/attestations.js";
import { setLastProcessedBlock } from "./db.js";
import { logger } from "./logger.js";

interface ContractConfig {
  address: Address;
  abi: readonly unknown[];
  name: string;
}

export class EventPoller {
  private lastProcessedBlock: bigint;
  private contracts: ContractConfig[];
  private attestationRegistryAddress: Address | null;

  constructor(
    private client: PublicClient,
    private pool: pg.Pool,
    private agentRegistryAddress: Address,
    private intentBookAddress: Address,
    private policyModuleAddress: Address,
    startBlock: bigint,
    attestationRegistryAddress: Address | null = null,
  ) {
    this.lastProcessedBlock = startBlock > 0n ? startBlock - 1n : 0n;
    this.attestationRegistryAddress = attestationRegistryAddress;
    this.contracts = [
      { address: agentRegistryAddress, abi: AgentRegistryABI as unknown as readonly unknown[], name: "AgentRegistry" },
      { address: intentBookAddress, abi: IntentBookABI as unknown as readonly unknown[], name: "IntentBook" },
      { address: policyModuleAddress, abi: PolicyModuleABI as unknown as readonly unknown[], name: "PolicyModule" },
    ];
    if (attestationRegistryAddress) {
      this.contracts.push({
        address: attestationRegistryAddress,
        abi: AttestationRegistryABI as unknown as readonly unknown[],
        name: "AttestationRegistry",
      });
    }
  }

  async poll(): Promise<number> {
    const currentBlock = await this.client.getBlockNumber();
    const fromBlock = this.lastProcessedBlock + 1n;

    if (fromBlock > currentBlock) {
      logger.debug(`No new blocks (current=${currentBlock})`);
      return 0;
    }

    logger.debug(`Polling blocks ${fromBlock}–${currentBlock}`);

    // Fetch logs from all 3 contracts in this block range
    const allLogs: Log[] = [];
    for (const contract of this.contracts) {
      const logs = await this.client.getLogs({
        address: contract.address,
        fromBlock,
        toBlock: currentBlock,
      });
      allLogs.push(...logs);
    }

    // Sort by blockNumber, then logIndex for deterministic ordering
    allLogs.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return Number(a.blockNumber! - b.blockNumber!);
      }
      return Number(a.logIndex! - b.logIndex!);
    });

    if (allLogs.length > 0) {
      logger.info(`Found ${allLogs.length} event(s) in blocks ${fromBlock}–${currentBlock}`);
    }

    // Route each log to the correct handler
    for (const log of allLogs) {
      await this.routeLog(log);
      await this.recordTxReceipt(log);
    }

    this.lastProcessedBlock = currentBlock;
    await setLastProcessedBlock(this.pool, currentBlock);

    return allLogs.length;
  }

  private async routeLog(log: Log): Promise<void> {
    const address = log.address.toLowerCase();

    if (address === this.agentRegistryAddress.toLowerCase()) {
      await this.routeAgentRegistryLog(log);
    } else if (address === this.intentBookAddress.toLowerCase()) {
      await this.routeIntentBookLog(log);
    } else if (address === this.policyModuleAddress.toLowerCase()) {
      await this.routePolicyModuleLog(log);
    } else if (this.attestationRegistryAddress && address === this.attestationRegistryAddress.toLowerCase()) {
      await this.routeAttestationRegistryLog(log);
    }
  }

  private async routeAgentRegistryLog(log: Log): Promise<void> {
    try {
      const decoded = decodeEventLog({
        abi: AgentRegistryABI,
        data: log.data,
        topics: log.topics,
      });

      switch (decoded.eventName) {
        case "AgentRegistered":
          await handleAgentRegistered(this.pool, this.client, log, this.agentRegistryAddress);
          break;
        case "AgentUpdated":
          await handleAgentUpdated(this.pool, log);
          break;
        case "AgentRevoked":
          await handleAgentRevoked(this.pool, log);
          break;
      }
    } catch (err) {
      logger.warn(`Failed to decode AgentRegistry log: ${err}`);
    }
  }

  private async routeIntentBookLog(log: Log): Promise<void> {
    try {
      const decoded = decodeEventLog({
        abi: IntentBookABI,
        data: log.data,
        topics: log.topics,
      });

      switch (decoded.eventName) {
        case "IntentSubmitted":
          await handleIntentSubmitted(this.pool, this.client, log, this.intentBookAddress);
          break;
        case "IntentFilled":
          await handleIntentFilled(this.pool, log);
          break;
        case "IntentCancelled":
          await handleIntentCancelled(this.pool, log);
          break;
      }
    } catch (err) {
      logger.warn(`Failed to decode IntentBook log: ${err}`);
    }
  }

  private async routePolicyModuleLog(log: Log): Promise<void> {
    try {
      const decoded = decodeEventLog({
        abi: PolicyModuleABI,
        data: log.data,
        topics: log.topics,
      });

      switch (decoded.eventName) {
        case "SpendLimitSet":
          await handleSpendLimitSet(this.pool, log);
          break;
        case "TargetAllowlistUpdated":
          await handleTargetAllowlistUpdated(this.pool, log);
          break;
        case "FunctionAllowlistUpdated":
          await handleFunctionAllowlistUpdated(this.pool, log);
          break;
        case "SpendRecorded":
          await handleSpendRecorded(log);
          break;
      }
    } catch (err) {
      logger.warn(`Failed to decode PolicyModule log: ${err}`);
    }
  }

  private async routeAttestationRegistryLog(log: Log): Promise<void> {
    try {
      const decoded = decodeEventLog({
        abi: AttestationRegistryABI,
        data: log.data,
        topics: log.topics,
      });

      switch (decoded.eventName) {
        case "AttestationSubmitted":
          await handleAttestationSubmitted(this.pool, log);
          break;
        case "AttestationRevoked":
          await handleAttestationRevoked(this.pool, log);
          break;
      }
    } catch (err) {
      logger.warn(`Failed to decode AttestationRegistry log: ${err}`);
    }
  }

  private async recordTxReceipt(log: Log): Promise<void> {
    if (!log.transactionHash) return;

    try {
      const decoded = this.tryDecodeLog(log);
      const eventSummary = decoded
        ? { eventName: decoded.eventName, args: Object.fromEntries(
            Object.entries(decoded.args as Record<string, unknown>).map(
              ([k, v]) => [k, typeof v === "bigint" ? v.toString() : v],
            ),
          )}
        : { raw: true };

      await this.pool.query(
        `INSERT INTO tx_receipts (tx_hash, block_number, from_address, to_address, events)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (tx_hash) DO UPDATE SET
           events = tx_receipts.events || $5::jsonb`,
        [
          log.transactionHash,
          Number(log.blockNumber),
          "", // from_address not available from log alone, will be empty
          log.address.toLowerCase(),
          JSON.stringify([eventSummary]),
        ],
      );
    } catch {
      // tx_receipt recording is best-effort
    }
  }

  private tryDecodeLog(log: Log): { eventName: string; args: unknown } | null {
    const address = log.address.toLowerCase();
    try {
      if (address === this.agentRegistryAddress.toLowerCase()) {
        return decodeEventLog({ abi: AgentRegistryABI, data: log.data, topics: log.topics });
      } else if (address === this.intentBookAddress.toLowerCase()) {
        return decodeEventLog({ abi: IntentBookABI, data: log.data, topics: log.topics });
      } else if (address === this.policyModuleAddress.toLowerCase()) {
        return decodeEventLog({ abi: PolicyModuleABI, data: log.data, topics: log.topics });
      } else if (this.attestationRegistryAddress && address === this.attestationRegistryAddress.toLowerCase()) {
        return decodeEventLog({ abi: AttestationRegistryABI, data: log.data, topics: log.topics });
      }
    } catch {
      // Failed to decode, return null
    }
    return null;
  }
}
