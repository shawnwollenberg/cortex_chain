import type pg from "pg";
import type { Log } from "viem";
import { decodeEventLog } from "viem";
import { AttestationRegistryABI } from "../abi/AttestationRegistry.js";
import { logger } from "../logger.js";

export async function handleAttestationSubmitted(
  pool: pg.Pool,
  log: Log,
): Promise<void> {
  const decoded = decodeEventLog({
    abi: AttestationRegistryABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "AttestationSubmitted") return;

  const { id, attester, schema, subject } = decoded.args;

  await pool.query(
    `INSERT INTO attestations (attestation_id, attester, schema_hash, subject, data_hash, timestamp, revoked, block_number)
     VALUES ($1, $2, $3, $4, '', $5, false, $6)
     ON CONFLICT (attestation_id) DO UPDATE SET
       attester = $2, schema_hash = $3, subject = $4,
       block_number = $6, updated_at = now()`,
    [
      id.toString(),
      attester.toLowerCase(),
      schema,
      subject,
      Number(log.blockNumber), // timestamp from block — approximate
      Number(log.blockNumber),
    ],
  );

  logger.info(`Indexed AttestationSubmitted: id=${id}, attester=${attester}`);
}

export async function handleAttestationRevoked(
  pool: pg.Pool,
  log: Log,
): Promise<void> {
  const decoded = decodeEventLog({
    abi: AttestationRegistryABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "AttestationRevoked") return;

  const { id } = decoded.args;

  await pool.query(
    `UPDATE attestations SET revoked = true, block_number = $1, updated_at = now()
     WHERE attestation_id = $2`,
    [Number(log.blockNumber), id.toString()],
  );

  logger.info(`Indexed AttestationRevoked: id=${id}`);
}
