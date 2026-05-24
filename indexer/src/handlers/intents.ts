import type pg from "pg";
import type { PublicClient, Address, Log } from "viem";
import { decodeEventLog, encodeAbiParameters, keccak256 } from "viem";
import { IntentBookABI } from "../abi/IntentBook.js";
import { logger } from "../logger.js";

const CONSTRAINTS_TYPEHASH = keccak256(
  new TextEncoder().encode("Constraints(uint256 amountInMax,uint256 amountOutMin,uint256 deadline,uint16 slippageBps)"),
);
const EXECUTION_REQUIREMENTS_TYPEHASH = keccak256(
  new TextEncoder().encode("ExecutionRequirements(address target,bytes32 dataHash,bytes32 requiredAttestationSubject,bytes32 requiredAttestationSchema,bytes32 metadataURIHash)"),
);
const INTENT_TYPEHASH = keccak256(
  new TextEncoder().encode("Intent(address owner,uint8 intentType,Constraints constraints,ExecutionRequirements execution,address inputToken,address outputToken,uint256 nonce)Constraints(uint256 amountInMax,uint256 amountOutMin,uint256 deadline,uint16 slippageBps)ExecutionRequirements(address target,bytes32 dataHash,bytes32 requiredAttestationSubject,bytes32 requiredAttestationSchema,bytes32 metadataURIHash)"),
);

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
       amount_in_max, amount_out_min, deadline, slippage_bps, nonce, status, block_number,
       execution_target, execution_data_hash, required_attestation_subject, required_attestation_schema, metadata_uri_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'OPEN', $11, $12, $13, $14, $15, $16)
     ON CONFLICT (intent_id) DO UPDATE SET
       owner = $2, intent_type = $3, input_token = $4, output_token = $5,
       amount_in_max = $6, amount_out_min = $7, deadline = $8, slippage_bps = $9,
       nonce = $10, block_number = $11, execution_target = $12, execution_data_hash = $13,
       required_attestation_subject = $14, required_attestation_schema = $15,
       metadata_uri_hash = $16, updated_at = now()`,
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
      intent.execution.target.toLowerCase(),
      intent.execution.dataHash,
      intent.execution.requiredAttestationSubject,
      intent.execution.requiredAttestationSchema,
      intent.execution.metadataURIHash,
    ],
  );

  const intentHash = hashIntentStruct({
    owner: intent.owner,
    intentType: intent.intentType,
    constraints: {
      amountInMax: intent.constraints.amountInMax,
      amountOutMin: intent.constraints.amountOutMin,
      deadline: intent.constraints.deadline,
      slippageBps: intent.constraints.slippageBps,
    },
    execution: {
      target: intent.execution.target,
      dataHash: intent.execution.dataHash,
      requiredAttestationSubject: intent.execution.requiredAttestationSubject,
      requiredAttestationSchema: intent.execution.requiredAttestationSchema,
      metadataURIHash: intent.execution.metadataURIHash,
    },
    inputToken: intent.inputToken,
    outputToken: intent.outputToken,
    nonce: intent.nonce,
  });

  await pool.query(
    `INSERT INTO intent_metadata
      (intent_id, execution_target, execution_data, required_attestation_subject, required_attestation_schema)
     SELECT $1, execution_target, execution_data, required_attestation_subject, required_attestation_schema
     FROM pending_intent_metadata
     WHERE intent_hash = $2
     ON CONFLICT (intent_id) DO UPDATE SET
      execution_target = EXCLUDED.execution_target,
      execution_data = EXCLUDED.execution_data,
      required_attestation_subject = EXCLUDED.required_attestation_subject,
      required_attestation_schema = EXCLUDED.required_attestation_schema,
      updated_at = now()`,
    [intentId.toString(), intentHash],
  );

  await pool.query(
    `UPDATE pending_intent_metadata
     SET intent_id = $1, updated_at = now()
     WHERE intent_hash = $2`,
    [intentId.toString(), intentHash],
  );

  logger.info(`Indexed IntentSubmitted: intentId=${intentId}, owner=${owner}, intentHash=${intentHash}`);
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

  await pool.query(
    `UPDATE solvers
     SET fills = fills + 1,
       successful_fills = successful_fills + 1,
       total_latency_blocks = total_latency_blocks + GREATEST($2 - COALESCE((
         SELECT block_number FROM intents WHERE intent_id = $1
       ), $2), 0),
       total_surplus_out = total_surplus_out + GREATEST($4 - COALESCE((
         SELECT amount_out_min FROM intents WHERE intent_id = $1
       ), $4), 0),
       block_number = $2,
       updated_at = now()
     WHERE operator = $3`,
    [intentId.toString(), Number(log.blockNumber), solver.toLowerCase(), amountOut.toString()],
  );

  logger.info(`Indexed IntentFilled: intentId=${intentId}, solver=${solver}`);
}

export async function handleIntentFillProof(
  pool: pg.Pool,
  log: Log,
): Promise<void> {
  const decoded = decodeEventLog({
    abi: IntentBookABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "IntentFillProof") return;

  const { intentId, resultHash, traceHash, attestationId } = decoded.args;
  await pool.query(
    `UPDATE fills
     SET result_hash = $1, trace_hash = $2, attestation_id = NULLIF($3, '0')::numeric
     WHERE intent_id = $4`,
    [resultHash, traceHash, attestationId.toString(), intentId.toString()],
  );

  logger.info(`Indexed IntentFillProof: intentId=${intentId}, attestationId=${attestationId}`);
}

export async function handleSolverBidSubmitted(pool: pg.Pool, log: Log): Promise<void> {
  const decoded = decodeEventLog({
    abi: IntentBookABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "SolverBidSubmitted") return;

  const { intentId, bidId, solver, amountIn, amountOut, fee, validUntil, executionHash } = decoded.args;

  await pool.query(
    `INSERT INTO solver_bids
      (chain_bid_id, intent_id, solver, amount_in, amount_out, fee, valid_until, execution_plan, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN')
     ON CONFLICT (intent_id, chain_bid_id) WHERE chain_bid_id IS NOT NULL DO UPDATE SET
      solver = $3,
      amount_in = $4,
      amount_out = $5,
      fee = $6,
      valid_until = $7,
      execution_plan = $8,
      updated_at = now()`,
    [
      bidId.toString(),
      intentId.toString(),
      solver.toLowerCase(),
      amountIn.toString(),
      amountOut.toString(),
      fee.toString(),
      validUntil.toString(),
      JSON.stringify({ execution_hash: executionHash }),
    ],
  );

  logger.info(`Indexed SolverBidSubmitted: intentId=${intentId}, bidId=${bidId}, solver=${solver}`);
}

export async function handleSolverBidSelected(pool: pg.Pool, log: Log): Promise<void> {
  const decoded = decodeEventLog({
    abi: IntentBookABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "SolverBidSelected") return;

  const { intentId, bidId, solver } = decoded.args;

  await pool.query(
    `UPDATE solver_bids
     SET status = CASE WHEN chain_bid_id = $2 THEN 'SELECTED' ELSE 'REJECTED' END,
       selected_at = CASE WHEN chain_bid_id = $2 THEN now() ELSE selected_at END,
       updated_at = now()
     WHERE intent_id = $1 AND status = 'OPEN'`,
    [intentId.toString(), bidId.toString()],
  );

  logger.info(`Indexed SolverBidSelected: intentId=${intentId}, bidId=${bidId}, solver=${solver}`);
}

interface HashableIntent {
  owner: Address;
  intentType: number;
  constraints: {
    amountInMax: bigint;
    amountOutMin: bigint;
    deadline: bigint;
    slippageBps: number;
  };
  execution: {
    target: Address;
    dataHash: `0x${string}`;
    requiredAttestationSubject: `0x${string}`;
    requiredAttestationSchema: `0x${string}`;
    metadataURIHash: `0x${string}`;
  };
  inputToken: Address;
  outputToken: Address;
  nonce: bigint;
}

function hashIntentStruct(intent: HashableIntent): `0x${string}` {
  const constraintsHash = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint16" },
      ],
      [
        CONSTRAINTS_TYPEHASH,
        intent.constraints.amountInMax,
        intent.constraints.amountOutMin,
        intent.constraints.deadline,
        intent.constraints.slippageBps,
      ],
    ),
  );
  const executionHash = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "address" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
      ],
      [
        EXECUTION_REQUIREMENTS_TYPEHASH,
        intent.execution.target,
        intent.execution.dataHash,
        intent.execution.requiredAttestationSubject,
        intent.execution.requiredAttestationSchema,
        intent.execution.metadataURIHash,
      ],
    ),
  );

  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "address" },
        { type: "uint8" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
      ],
      [
        INTENT_TYPEHASH,
        intent.owner,
        intent.intentType,
        constraintsHash,
        executionHash,
        intent.inputToken,
        intent.outputToken,
        intent.nonce,
      ],
    ),
  );
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
