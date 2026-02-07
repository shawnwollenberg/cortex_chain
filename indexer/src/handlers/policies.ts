import type pg from "pg";
import type { Log } from "viem";
import { decodeEventLog } from "viem";
import { PolicyModuleABI } from "../abi/PolicyModule.js";
import { logger } from "../logger.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_SELECTOR = "0x00000000";

export async function handleSpendLimitSet(
  pool: pg.Pool,
  log: Log,
): Promise<void> {
  const decoded = decodeEventLog({
    abi: PolicyModuleABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "SpendLimitSet") return;

  const { account, token, maxPerDay } = decoded.args;

  await pool.query(
    `INSERT INTO policies (account, policy_type, token, target, selector, value, block_number)
     VALUES ($1, 'spend_limit', $2, $3, $4, $5, $6)
     ON CONFLICT (account, policy_type, token, target, selector) DO UPDATE SET
       value = $5, block_number = $6, updated_at = now()`,
    [
      account.toLowerCase(),
      token.toLowerCase(),
      ZERO_ADDRESS,
      ZERO_SELECTOR,
      maxPerDay.toString(),
      Number(log.blockNumber),
    ],
  );

  logger.info(`Indexed SpendLimitSet: account=${account}, token=${token}, maxPerDay=${maxPerDay}`);
}

export async function handleTargetAllowlistUpdated(
  pool: pg.Pool,
  log: Log,
): Promise<void> {
  const decoded = decodeEventLog({
    abi: PolicyModuleABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "TargetAllowlistUpdated") return;

  const { account, target, allowed } = decoded.args;

  await pool.query(
    `INSERT INTO policies (account, policy_type, token, target, selector, value, block_number)
     VALUES ($1, 'target_allowlist', $2, $3, $4, $5, $6)
     ON CONFLICT (account, policy_type, token, target, selector) DO UPDATE SET
       value = $5, block_number = $6, updated_at = now()`,
    [
      account.toLowerCase(),
      ZERO_ADDRESS,
      target.toLowerCase(),
      ZERO_SELECTOR,
      allowed.toString(),
      Number(log.blockNumber),
    ],
  );

  logger.info(`Indexed TargetAllowlistUpdated: account=${account}, target=${target}, allowed=${allowed}`);
}

export async function handleFunctionAllowlistUpdated(
  pool: pg.Pool,
  log: Log,
): Promise<void> {
  const decoded = decodeEventLog({
    abi: PolicyModuleABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "FunctionAllowlistUpdated") return;

  const { account, target, selector, allowed } = decoded.args;

  await pool.query(
    `INSERT INTO policies (account, policy_type, token, target, selector, value, block_number)
     VALUES ($1, 'function_allowlist', $2, $3, $4, $5, $6)
     ON CONFLICT (account, policy_type, token, target, selector) DO UPDATE SET
       value = $5, block_number = $6, updated_at = now()`,
    [
      account.toLowerCase(),
      ZERO_ADDRESS,
      target.toLowerCase(),
      selector,
      allowed.toString(),
      Number(log.blockNumber),
    ],
  );

  logger.info(`Indexed FunctionAllowlistUpdated: account=${account}, target=${target}, selector=${selector}`);
}

export async function handleSpendRecorded(log: Log): Promise<void> {
  const decoded = decodeEventLog({
    abi: PolicyModuleABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "SpendRecorded") return;

  const { account, token, amount, dailyTotal } = decoded.args;

  // SpendRecorded doesn't update policy state — it's captured in tx_receipts only
  logger.debug(
    `SpendRecorded: account=${account}, token=${token}, amount=${amount}, dailyTotal=${dailyTotal}`,
  );
}
