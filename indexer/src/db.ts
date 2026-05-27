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
  const migrationsDir = resolve(__dirname, "..", "..", "migrations");
  const migration001 = readFileSync(resolve(migrationsDir, "001_init.sql"), "utf-8");
  await pool.query(migration001);
  const migration002 = readFileSync(resolve(migrationsDir, "002_attestations.sql"), "utf-8");
  await pool.query(migration002);
  const migration003 = readFileSync(resolve(migrationsDir, "003_participants.sql"), "utf-8");
  await pool.query(migration003);
  const migration004 = readFileSync(resolve(migrationsDir, "004_intent_metadata.sql"), "utf-8");
  await pool.query(migration004);
  const migration005 = readFileSync(resolve(migrationsDir, "005_pending_intent_metadata.sql"), "utf-8");
  await pool.query(migration005);
  const migration006 = readFileSync(resolve(migrationsDir, "006_bids_attestation_schemas.sql"), "utf-8");
  await pool.query(migration006);
  const migration007 = readFileSync(resolve(migrationsDir, "007_onchain_intent_commitments.sql"), "utf-8");
  await pool.query(migration007);
  const migration008 = readFileSync(resolve(migrationsDir, "008_fill_proofs.sql"), "utf-8");
  await pool.query(migration008);
  const migration009 = readFileSync(resolve(migrationsDir, "009_commerce.sql"), "utf-8");
  await pool.query(migration009);
  const migration010 = readFileSync(resolve(migrationsDir, "010_catalog_documents.sql"), "utf-8");
  await pool.query(migration010);
  const migration011 = readFileSync(resolve(migrationsDir, "011_quote_documents.sql"), "utf-8");
  await pool.query(migration011);
  const migration012 = readFileSync(resolve(migrationsDir, "012_fulfillment_payloads.sql"), "utf-8");
  await pool.query(migration012);
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
