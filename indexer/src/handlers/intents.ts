import type pg from "pg";
import type { PublicClient, Address, Log } from "viem";
import { decodeEventLog } from "viem";
import { IntentBookABI } from "../abi/IntentBook.js";
import { logger } from "../logger.js";

export async function handleIntentSubmitted(
  pool: pg.Pool,
  client: PublicClient,
  log: Log,
  intentBookAddress: Address,
): Promise<void> {
  const decoded = decodeEventLog({
    abi: IntentBookABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "IntentSubmitted") return;

  const { intentId, owner } = decoded.args;

  // Fetch full intent data from the contract
  const intent = await client.readContract({
    address: intentBookAddress,
    abi: IntentBookABI,
    functionName: "getIntent",
    args: [intentId],
  });

  await pool.query(
    `INSERT INTO intents (intent_id, owner, intent_type, input_token, output_token,
       amount_in_max, amount_out_min, deadline, slippage_bps, nonce, status, block_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'OPEN', $11)
     ON CONFLICT (intent_id) DO UPDATE SET
       owner = $2, intent_type = $3, input_token = $4, output_token = $5,
       amount_in_max = $6, amount_out_min = $7, deadline = $8, slippage_bps = $9,
       nonce = $10, block_number = $11, updated_at = now()`,
    [
      intentId.toString(),
      owner.toLowerCase(),
      intent.intentType,
      intent.inputToken.toLowerCase(),
      intent.outputToken.toLowerCase(),
      intent.constraints.amountInMax.toString(),
      intent.constraints.amountOutMin.toString(),
      intent.constraints.deadline.toString(),
      intent.constraints.slippageBps,
      intent.nonce.toString(),
      Number(log.blockNumber),
    ],
  );

  logger.info(`Indexed IntentSubmitted: intentId=${intentId}, owner=${owner}`);
}

export async function handleIntentFilled(
  pool: pg.Pool,
  log: Log,
): Promise<void> {
  const decoded = decodeEventLog({
    abi: IntentBookABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "IntentFilled") return;

  const { intentId, solver, amountIn, amountOut } = decoded.args;

  // Insert fill record
  await pool.query(
    `INSERT INTO fills (intent_id, solver, amount_in, amount_out, tx_hash, block_number)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      intentId.toString(),
      solver.toLowerCase(),
      amountIn.toString(),
      amountOut.toString(),
      log.transactionHash,
      Number(log.blockNumber),
    ],
  );

  // Update intent status
  await pool.query(
    `UPDATE intents SET status = 'FILLED', block_number = $1, updated_at = now()
     WHERE intent_id = $2`,
    [Number(log.blockNumber), intentId.toString()],
  );

  logger.info(`Indexed IntentFilled: intentId=${intentId}, solver=${solver}`);
}

export async function handleIntentCancelled(
  pool: pg.Pool,
  log: Log,
): Promise<void> {
  const decoded = decodeEventLog({
    abi: IntentBookABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "IntentCancelled") return;

  const { intentId } = decoded.args;

  await pool.query(
    `UPDATE intents SET status = 'CANCELLED', block_number = $1, updated_at = now()
     WHERE intent_id = $2`,
    [Number(log.blockNumber), intentId.toString()],
  );

  logger.info(`Indexed IntentCancelled: intentId=${intentId}`);
}
