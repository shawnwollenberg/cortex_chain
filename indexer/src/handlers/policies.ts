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

export async function handlePaymentPolicySet(pool: pg.Pool, log: Log): Promise<void> {
  const decoded = decodeEventLog({
    abi: PolicyModuleABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "PaymentPolicySet") return;

  const { account, merchant, token, facilitator, maxPerPayment, maxPerDay, allowed } = decoded.args;
  await pool.query(
    `INSERT INTO policies (account, policy_type, token, target, selector, value, block_number)
     VALUES ($1, 'signed_payment_policy', $2, $3, $4, $5, $6)
     ON CONFLICT (account, policy_type, token, target, selector) DO UPDATE SET
       value = $5, block_number = $6, updated_at = now()`,
    [
      account.toLowerCase(),
      token.toLowerCase(),
      merchant.toLowerCase(),
      "0x00000000",
      JSON.stringify({
        facilitator: facilitator.toLowerCase(),
        max_per_payment: maxPerPayment.toString(),
        max_per_day: maxPerDay.toString(),
        allowed,
      }),
      Number(log.blockNumber),
    ],
  );
}

export async function handleSignedPaymentRecorded(log: Log): Promise<void> {
  const decoded = decodeEventLog({
    abi: PolicyModuleABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "SignedPaymentRecorded") return;

  const { account, merchant, token, facilitator, amount, paymentHash, dailyTotal } = decoded.args;
  logger.debug(
    `SignedPaymentRecorded: account=${account}, merchant=${merchant}, token=${token}, facilitator=${facilitator}, amount=${amount}, paymentHash=${paymentHash}, dailyTotal=${dailyTotal}`,
  );
}

export async function handleFunctionAllowlistModeUpdated(
  pool: pg.Pool,
  log: Log,
): Promise<void> {
  const decoded = decodeEventLog({
    abi: PolicyModuleABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "FunctionAllowlistModeUpdated") return;

  const { account, enabled } = decoded.args;

  await pool.query(
    `INSERT INTO policies (account, policy_type, token, target, selector, value, block_number)
     VALUES ($1, 'function_allowlist_mode', $2, $3, $4, $5, $6)
     ON CONFLICT (account, policy_type, token, target, selector) DO UPDATE SET
       value = $5, block_number = $6, updated_at = now()`,
    [
      account.toLowerCase(),
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_SELECTOR,
      enabled.toString(),
      Number(log.blockNumber),
    ],
  );
}

export async function handleGuardianSet(pool: pg.Pool, log: Log): Promise<void> {
  const decoded = decodeEventLog({
    abi: PolicyModuleABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "GuardianSet") return;

  const { account, guardian } = decoded.args;

  await pool.query(
    `INSERT INTO policies (account, policy_type, token, target, selector, value, block_number)
     VALUES ($1, 'guardian', $2, $3, $4, $5, $6)
     ON CONFLICT (account, policy_type, token, target, selector) DO UPDATE SET
       value = $5, block_number = $6, updated_at = now()`,
    [
      account.toLowerCase(),
      ZERO_ADDRESS,
      guardian.toLowerCase(),
      ZERO_SELECTOR,
      guardian.toLowerCase(),
      Number(log.blockNumber),
    ],
  );
}

export async function handleAccountFrozen(pool: pg.Pool, log: Log): Promise<void> {
  const decoded = decodeEventLog({
    abi: PolicyModuleABI,
    data: log.data,
    topics: log.topics,
  });
  if (decoded.eventName !== "AccountFrozen") return;

  const { account, frozen } = decoded.args;

  await pool.query(
    `INSERT INTO policies (account, policy_type, token, target, selector, value, block_number)
     VALUES ($1, 'account_frozen', $2, $3, $4, $5, $6)
     ON CONFLICT (account, policy_type, token, target, selector) DO UPDATE SET
       value = $5, block_number = $6, updated_at = now()`,
    [
      account.toLowerCase(),
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_SELECTOR,
      frozen.toString(),
      Number(log.blockNumber),
    ],
  );
}
