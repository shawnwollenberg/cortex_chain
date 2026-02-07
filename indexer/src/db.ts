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
  const migrationPath = resolve(__dirname, "..", "..", "migrations", "001_init.sql");
  const sql = readFileSync(migrationPath, "utf-8");
  await pool.query(sql);
  logger.info("Migrations applied");
}

export async function getLastProcessedBlock(pool: pg.Pool): Promise<bigint | null> {
  const result = await pool.query(
    "SELECT value FROM indexer_state WHERE key = 'last_processed_block'",
  );
  if (result.rows.length === 0) return null;
  return BigInt(result.rows[0].value);
}

export async function setLastProcessedBlock(pool: pg.Pool, block: bigint): Promise<void> {
  await pool.query(
    `INSERT INTO indexer_state (key, value, updated_at)
     VALUES ('last_processed_block', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
    [block.toString()],
  );
}
