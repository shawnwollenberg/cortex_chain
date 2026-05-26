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
  const migrationDirs = [
    resolve(__dirname, "..", "..", "indexer", "migrations"),
    resolve(__dirname, "..", "..", "..", "indexer", "migrations"),
  ];

  for (const migrationDir of migrationDirs) {
    if (existsSync(resolve(migrationDir, "001_init.sql"))) {
      for (const file of ["001_init.sql", "002_attestations.sql", "003_participants.sql", "004_intent_metadata.sql", "005_pending_intent_metadata.sql", "006_bids_attestation_schemas.sql", "007_onchain_intent_commitments.sql", "008_fill_proofs.sql", "009_commerce.sql", "010_catalog_documents.sql"]) {
        const migrationPath = resolve(migrationDir, file);
        if (existsSync(migrationPath)) {
          const sql = readFileSync(migrationPath, "utf-8");
          await pool.query(sql);
        }
      }
      logger.info("Migrations applied");
      return;
    }
  }

  logger.warn("Migration file not found — assuming schema already exists");
}
