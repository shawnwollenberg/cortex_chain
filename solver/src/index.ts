import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { loadConfig } from "./config.js";
import { IntentListener } from "./listener.js";
import { IntentExecutor } from "./executor.js";
import { logger, setLogLevel } from "./logger.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.logLevel);

  const account = privateKeyToAccount(config.solverPrivateKey);
  const chain: Chain = foundry;

  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl),
  });

  const currentBlock = await publicClient.getBlockNumber();
  logger.info(`Solver address: ${account.address}`);
  logger.info(`IntentBook: ${config.intentBookAddress}`);
  logger.info(`Current block: ${currentBlock}`);

  const startBlock =
    config.startBlock === "latest" ? currentBlock : config.startBlock;

  const listener = new IntentListener(
    publicClient,
    config.intentBookAddress,
    startBlock,
  );
  const executor = new IntentExecutor(
    publicClient,
    walletClient,
    config.intentBookAddress,
  );

  logger.info(
    `Starting polling loop (interval=${config.pollIntervalMs}ms, startBlock=${startBlock})`,
  );

  let running = true;
  const shutdown = () => {
    logger.info("Shutting down...");
    running = false;
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  while (running) {
    const events = await listener.pollForEvents();
    for (const event of events) {
      logger.info(
        `Processing intent ${event.intentId} from ${event.owner} (tx: ${event.transactionHash})`,
      );
      await executor.processIntent(event.intentId);
    }
    await sleep(config.pollIntervalMs);
  }
}

main().catch((err) => {
  logger.error("Fatal error:", err);
  process.exit(1);
});
