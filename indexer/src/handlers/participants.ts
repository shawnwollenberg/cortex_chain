import type pg from "pg";
import type { Log } from "viem";
import { decodeEventLog } from "viem";
import { SolverRegistryABI } from "../abi/SolverRegistry.js";
import { AttestorRegistryABI } from "../abi/AttestorRegistry.js";
import { logger } from "../logger.js";

export async function handleSolverRegistryLog(pool: pg.Pool, log: Log): Promise<void> {
  const decoded = decodeEventLog({
    abi: SolverRegistryABI,
    data: log.data,
    topics: log.topics,
  });

  switch (decoded.eventName) {
    case "SolverRegistered": {
      const { solverId, operator, metadataURI, capabilitiesHash, bond } = decoded.args;
      await pool.query(
        `INSERT INTO solvers
          (solver_id, operator, metadata_uri, capabilities_hash, bond, block_number)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (solver_id) DO UPDATE SET
           operator = $2, metadata_uri = $3, capabilities_hash = $4, bond = $5,
           active = true, block_number = $6, updated_at = now()`,
        [
          solverId.toString(),
          operator.toLowerCase(),
          metadataURI,
          capabilitiesHash,
          bond.toString(),
          Number(log.blockNumber),
        ],
      );
      logger.info(`Indexed SolverRegistered: solverId=${solverId}, operator=${operator}`);
      break;
    }
    case "SolverUpdated": {
      const { solverId, metadataURI, capabilitiesHash, active } = decoded.args;
      await pool.query(
        `UPDATE solvers SET metadata_uri = $1, capabilities_hash = $2, active = $3,
          block_number = $4, updated_at = now()
         WHERE solver_id = $5`,
        [metadataURI, capabilitiesHash, active, Number(log.blockNumber), solverId.toString()],
      );
      logger.info(`Indexed SolverUpdated: solverId=${solverId}`);
      break;
    }
    case "SolverBondChanged": {
      const { solverId, bond } = decoded.args;
      await pool.query(
        `UPDATE solvers SET bond = $1, block_number = $2, updated_at = now() WHERE solver_id = $3`,
        [bond.toString(), Number(log.blockNumber), solverId.toString()],
      );
      break;
    }
  }
}

export async function handleAttestorRegistryLog(pool: pg.Pool, log: Log): Promise<void> {
  const decoded = decodeEventLog({
    abi: AttestorRegistryABI,
    data: log.data,
    topics: log.topics,
  });

  switch (decoded.eventName) {
    case "AttestorRegistered": {
      const { attestorId, operator, metadataURI, schemasHash } = decoded.args;
      await pool.query(
        `INSERT INTO attestors
          (attestor_id, operator, metadata_uri, schemas_hash, block_number)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (attestor_id) DO UPDATE SET
           operator = $2, metadata_uri = $3, schemas_hash = $4,
           active = true, block_number = $5, updated_at = now()`,
        [attestorId.toString(), operator.toLowerCase(), metadataURI, schemasHash, Number(log.blockNumber)],
      );
      logger.info(`Indexed AttestorRegistered: attestorId=${attestorId}, operator=${operator}`);
      break;
    }
    case "AttestorUpdated": {
      const { attestorId, metadataURI, schemasHash, active } = decoded.args;
      await pool.query(
        `UPDATE attestors SET metadata_uri = $1, schemas_hash = $2, active = $3,
          block_number = $4, updated_at = now()
         WHERE attestor_id = $5`,
        [metadataURI, schemasHash, active, Number(log.blockNumber), attestorId.toString()],
      );
      break;
    }
  }
}
