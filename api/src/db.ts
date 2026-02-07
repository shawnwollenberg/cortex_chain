import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl });
}

export async function runMigrations(pool: pg.Pool): Promise<void> {
  // Try multiple paths to handle both tsx (src/) and compiled (dist/src/) execution
  const candidates = [
    resolve(__dirname, "..", "..", "indexer", "migrations", "001_init.sql"),
    resolve(__dirname, "..", "..", "..", "indexer", "migrations", "001_init.sql"),
  ];

  for (const migrationPath of candidates) {
    if (existsSync(migrationPath)) {
      const sql = readFileSync(migrationPath, "utf-8");
      await pool.query(sql);
      logger.info("Migrations applied");
      return;
    }
  }

  logger.warn("Migration file not found — assuming schema already exists");
}
