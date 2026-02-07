import { createPublicClient, http, type Chain } from "viem";
import { foundry } from "viem/chains";
import { loadConfig } from "./config.js";
import { createPool, runMigrations, getLastProcessedBlock } from "./db.js";
import { EventPoller } from "./listener.js";
import { logger, setLogLevel } from "./logger.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.logLevel);

  const chain: Chain = foundry;
  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });

  const pool = createPool(config.databaseUrl);

  // Run schema migrations
  await runMigrations(pool);

  // Determine start block: resume from last processed or use config
  const lastBlock = await getLastProcessedBlock(pool);
  const startBlock = lastBlock !== null ? lastBlock + 1n : config.startBlock;

  const currentBlock = await publicClient.getBlockNumber();
  logger.info(`AgentRegistry: ${config.agentRegistryAddress}`);
  logger.info(`IntentBook:    ${config.intentBookAddress}`);
  logger.info(`PolicyModule:  ${config.policyModuleAddress}`);
  logger.info(`Current block: ${currentBlock}`);
  logger.info(`Start block:   ${startBlock}${lastBlock !== null ? " (resumed)" : ""}`);

  const poller = new EventPoller(
    publicClient,
    pool,
    config.agentRegistryAddress,
    config.intentBookAddress,
    config.policyModuleAddress,
    startBlock,
  );

  logger.info(`Starting polling loop (interval=${config.pollIntervalMs}ms)`);

  let running = true;
  const shutdown = async () => {
    logger.info("Shutting down...");
    running = false;
    await pool.end();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  while (running) {
    try {
      await poller.poll();
    } catch (err) {
      logger.error("Error during poll cycle:", err);
    }
    await sleep(config.pollIntervalMs);
  }
}

main().catch((err) => {
  logger.error("Fatal error:", err);
  process.exit(1);
});
