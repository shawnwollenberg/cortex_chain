import { loadConfig } from "./config.js";
import { setLogLevel, logger } from "./logger.js";
import { createPool, runMigrations } from "./db.js";
import { createApp } from "./app.js";

async function main(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.logLevel);

  logger.info("Starting API server...");

  const pool = createPool(config.databaseUrl);
  await runMigrations(pool);

  const app = createApp(pool);

  const server = app.listen(config.port, () => {
    logger.info(`API server listening on port ${config.port}`);
  });

  const shutdown = () => {
    logger.info("Shutting down...");
    server.close(() => {
      pool.end().then(() => {
        logger.info("Shutdown complete");
        process.exit(0);
      });
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
