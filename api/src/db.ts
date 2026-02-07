import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl });
}

export async function runMigrations(pool: pg.Pool): Promise<void> {
  const migrationPath = resolve(__dirname, "..", "..", "indexer", "migrations", "001_init.sql");
  const sql = readFileSync(migrationPath, "utf-8");
  await pool.query(sql);
  logger.info("Migrations applied");
}
