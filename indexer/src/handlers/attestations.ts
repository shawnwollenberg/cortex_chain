import type pg from "pg";
import type { Address, Log, PublicClient } from "viem";
import { decodeEventLog } from "viem";
import { AttestationRegistryABI } from "../abi/AttestationRegistry.js";
import { logger } from "../logger.js";

export async function handleAttestationSubmitted(
  pool: pg.Pool,
  client: PublicClient,
  log: Log,
  attestationRegistryAddress: Address,
): Promise<void> {
  const decoded = decodeEventLog({
    abi: AttestationRegistryABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "AttestationSubmitted") return;

  const { id, attester, schema, subject } = decoded.args;
  const attestation = await client.readContract({
    address: attestationRegistryAddress,
    abi: AttestationRegistryABI,
    functionName: "getAttestation",
    args: [id],
  });

  await pool.query(
    `INSERT INTO attestations (attestation_id, attester, schema_hash, subject, data_hash, timestamp, revoked, block_number)
     VALUES ($1, $2, $3, $4, $5, $6, false, $7)
     ON CONFLICT (attestation_id) DO UPDATE SET
       attester = $2, schema_hash = $3, subject = $4, data_hash = $5, timestamp = $6,
       block_number = $7, updated_at = now()`,
    [
      id.toString(),
      attester.toLowerCase(),
      schema,
      subject,
      attestation.dataHash,
      Number(attestation.timestamp),
      Number(log.blockNumber),
    ],
  );

  logger.info(`Indexed AttestationSubmitted: id=${id}, attester=${attester}`);

  await pool.query(
    `UPDATE attestors SET attestations = attestations + 1, updated_at = now()
     WHERE operator = $1`,
    [attester.toLowerCase()],
  );
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

  await pool.query(
    `UPDATE attestors
     SET revoked_attestations = revoked_attestations + 1, updated_at = now()
     WHERE operator = (
       SELECT attester FROM attestations WHERE attestation_id = $1
     )`,
    [id.toString()],
  );

  logger.info(`Indexed AttestationRevoked: id=${id}`);
}
