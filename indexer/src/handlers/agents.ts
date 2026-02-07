import type pg from "pg";
import type { PublicClient, Address, Log } from "viem";
import { decodeEventLog } from "viem";
import { AgentRegistryABI } from "../abi/AgentRegistry.js";
import { logger } from "../logger.js";

export async function handleAgentRegistered(
  pool: pg.Pool,
  client: PublicClient,
  log: Log,
  registryAddress: Address,
): Promise<void> {
  const decoded = decodeEventLog({
    abi: AgentRegistryABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "AgentRegistered") return;

  const { agentId, owner, metadataURI } = decoded.args;

  // Fetch full record from contract for pubkey + capabilitiesHash
  const record = await client.readContract({
    address: registryAddress,
    abi: AgentRegistryABI,
    functionName: "getAgent",
    args: [agentId],
  });

  await pool.query(
    `INSERT INTO agents (agent_id, owner, metadata_uri, pubkey, capabilities_hash, revoked, block_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (agent_id) DO UPDATE SET
       owner = $2, metadata_uri = $3, pubkey = $4, capabilities_hash = $5,
       revoked = $6, block_number = $7, updated_at = now()`,
    [
      agentId.toString(),
      owner.toLowerCase(),
      metadataURI,
      record.pubkey,
      record.capabilitiesHash,
      record.revoked,
      Number(log.blockNumber),
    ],
  );

  logger.info(`Indexed AgentRegistered: agentId=${agentId}, owner=${owner}`);
}

export async function handleAgentUpdated(
  pool: pg.Pool,
  log: Log,
): Promise<void> {
  const decoded = decodeEventLog({
    abi: AgentRegistryABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "AgentUpdated") return;

  const { agentId, metadataURI, capabilitiesHash } = decoded.args;

  await pool.query(
    `UPDATE agents SET metadata_uri = $1, capabilities_hash = $2,
     block_number = $3, updated_at = now() WHERE agent_id = $4`,
    [metadataURI, capabilitiesHash, Number(log.blockNumber), agentId.toString()],
  );

  logger.info(`Indexed AgentUpdated: agentId=${agentId}`);
}

export async function handleAgentRevoked(
  pool: pg.Pool,
  log: Log,
): Promise<void> {
  const decoded = decodeEventLog({
    abi: AgentRegistryABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "AgentRevoked") return;

  const { agentId } = decoded.args;

  await pool.query(
    `UPDATE agents SET revoked = true, block_number = $1, updated_at = now()
     WHERE agent_id = $2`,
    [Number(log.blockNumber), agentId.toString()],
  );

  logger.info(`Indexed AgentRevoked: agentId=${agentId}`);
}
