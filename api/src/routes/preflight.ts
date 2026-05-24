import { Router } from "express";
import type pg from "pg";
import { isValidAddress } from "../utils.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_SELECTOR = "0x00000000";
const ERC20_TRANSFER = "0xa9059cbb";
const ERC20_APPROVE = "0x095ea7b3";
const ERC20_TRANSFER_FROM = "0x23b872dd";
const ERC721_SAFE_TRANSFER_FROM = "0x42842e0e";
const ERC721_SAFE_TRANSFER_FROM_BYTES = "0xb88d4fde";
const ERC721_TRANSFER_FROM = "0x23b872dd";
const ERC1155_SAFE_TRANSFER_FROM = "0xf242432a";
const ERC1155_SAFE_BATCH_TRANSFER_FROM = "0x2eb2c2d6";

function normalizeHex(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function getSelector(data: string): string {
  return data.length >= 10 ? data.slice(0, 10).toLowerCase() : ZERO_SELECTOR;
}

function parseUint256Word(data: string, wordIndex: number): bigint {
  const start = 10 + wordIndex * 64;
  const word = data.slice(start, start + 64);
  if (word.length !== 64) return 0n;
  return BigInt(`0x${word}`);
}

function describeCall(target: string, data: string): string {
  const selector = getSelector(data);
  if (selector === ZERO_SELECTOR) return `Native transfer or empty call to ${target}`;
  if (selector === ERC20_TRANSFER) return `ERC20 transfer from ${target}`;
  if (selector === ERC20_APPROVE) return `ERC20 approval on ${target}`;
  if (selector === ERC20_TRANSFER_FROM) return `ERC20/ERC721 transferFrom on ${target}`;
  if (selector === ERC721_SAFE_TRANSFER_FROM || selector === ERC721_SAFE_TRANSFER_FROM_BYTES) return `ERC721 safeTransferFrom on ${target}`;
  if (selector === ERC1155_SAFE_TRANSFER_FROM) return `ERC1155 safeTransferFrom on ${target}`;
  if (selector === ERC1155_SAFE_BATCH_TRANSFER_FROM) return `ERC1155 safeBatchTransferFrom on ${target}`;
  return `Contract call ${selector} on ${target}`;
}

function detectTokenSpend(target: string, data: string): { token: string; amount: bigint; standard: string } | null {
  const selector = getSelector(data);
  if (selector === ERC20_TRANSFER || selector === ERC20_APPROVE) {
    return { token: target, amount: parseUint256Word(data, 1), standard: "ERC20" };
  }
  if (selector === ERC20_TRANSFER_FROM) {
    return { token: target, amount: parseUint256Word(data, 2), standard: "ERC20_OR_ERC721" };
  }
  if (
    selector === ERC721_SAFE_TRANSFER_FROM ||
    selector === ERC721_SAFE_TRANSFER_FROM_BYTES
  ) {
    return { token: target, amount: 1n, standard: "ERC721" };
  }
  if (selector === ERC1155_SAFE_TRANSFER_FROM) {
    return { token: target, amount: parseUint256Word(data, 3), standard: "ERC1155" };
  }
  if (selector === ERC1155_SAFE_BATCH_TRANSFER_FROM) {
    return { token: target, amount: 0n, standard: "ERC1155_BATCH" };
  }
  return null;
}

export function createPreflightRouter(pool: pg.Pool): Router {
  const router = Router();

  router.post("/", async (req, res, next) => {
    try {
      const account = normalizeHex(req.body.account);
      const target = normalizeHex(req.body.target);
      const data = normalizeHex(req.body.data ?? "0x");
      const value = BigInt(String(req.body.value ?? "0"));

      if (!isValidAddress(account)) {
        res.status(400).json({ error: "Invalid account address" });
        return;
      }
      if (!isValidAddress(target)) {
        res.status(400).json({ error: "Invalid target address" });
        return;
      }
      if (!/^0x[0-9a-f]*$/.test(data)) {
        res.status(400).json({ error: "Invalid calldata" });
        return;
      }
      if (value < 0n) {
        res.status(400).json({ error: "Invalid value" });
        return;
      }

      const policies = await pool.query(
        `SELECT * FROM policies WHERE account = $1`,
        [account],
      );

      const denyReasons: string[] = [];
      const missingPolicies: string[] = [];

      const frozen = policies.rows.find(
        (p) => p.policy_type === "account_frozen" && p.value === "true",
      );
      if (frozen) {
        denyReasons.push("Account is frozen");
      }

      const targetAllowed = policies.rows.some(
        (p) => p.policy_type === "target_allowlist" && p.target === target && p.value === "true",
      );
      if (!targetAllowed) {
        denyReasons.push(`Target ${target} is not allowlisted`);
        missingPolicies.push("target_allowlist");
      }

      const selector = getSelector(data);
      const functionMode = policies.rows.find((p) => p.policy_type === "function_allowlist_mode");
      if (functionMode?.value === "true" && selector !== ZERO_SELECTOR) {
        const functionAllowed = policies.rows.some(
          (p) =>
            p.policy_type === "function_allowlist" &&
            p.target === target &&
            p.selector?.toLowerCase() === selector &&
            p.value === "true",
        );
        if (!functionAllowed) {
          denyReasons.push(`Function selector ${selector} is not allowlisted for ${target}`);
          missingPolicies.push("function_allowlist");
        }
      }

      const spendChecks: Array<{ token: string; attempted: string; max_per_day: string | null; remaining: string | null }> = [];
      if (value > 0n) {
        spendChecks.push(checkSpendLimit(policies.rows, ZERO_ADDRESS, value));
      }

      const tokenSpend = detectTokenSpend(target, data);
      if (tokenSpend && tokenSpend.amount > 0n) {
        spendChecks.push(checkSpendLimit(policies.rows, tokenSpend.token, tokenSpend.amount));
      }

      for (const check of spendChecks) {
        if (check.max_per_day !== null && BigInt(check.attempted) > BigInt(check.max_per_day)) {
          denyReasons.push(`Spend limit exceeded for token ${check.token}`);
        }
      }

      res.json({
        allowed: denyReasons.length === 0,
        account,
        target,
        selector,
        action: describeCall(target, data),
        value: value.toString(),
        reasons: denyReasons,
        missing_policies: [...new Set(missingPolicies)],
        spend_checks: spendChecks,
        required_policy_updates: buildPolicySuggestions(target, selector, spendChecks, [...new Set(missingPolicies)]),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function buildPolicySuggestions(
  target: string,
  selector: string,
  spendChecks: Array<{ token: string; attempted: string; max_per_day: string | null; remaining: string | null }>,
  missingPolicies: string[],
): Array<{ policy_type: string; target?: string; selector?: string; token?: string; suggested_value: string }> {
  const suggestions: Array<{ policy_type: string; target?: string; selector?: string; token?: string; suggested_value: string }> = [];
  if (missingPolicies.includes("target_allowlist")) {
    suggestions.push({ policy_type: "target_allowlist", target, suggested_value: "true" });
  }
  if (missingPolicies.includes("function_allowlist")) {
    suggestions.push({ policy_type: "function_allowlist", target, selector, suggested_value: "true" });
  }
  for (const check of spendChecks) {
    if (check.max_per_day === null || BigInt(check.attempted) > BigInt(check.max_per_day)) {
      suggestions.push({ policy_type: "spend_limit", token: check.token, suggested_value: check.attempted });
    }
  }
  return suggestions;
}

function checkSpendLimit(
  policies: Array<{ policy_type: string; token: string | null; value: string }>,
  token: string,
  attempted: bigint,
): { token: string; attempted: string; max_per_day: string | null; remaining: string | null } {
  const limit = policies.find(
    (p) => p.policy_type === "spend_limit" && p.token?.toLowerCase() === token,
  );
  if (!limit || limit.value === "0") {
    return { token, attempted: attempted.toString(), max_per_day: null, remaining: null };
  }
  const max = BigInt(limit.value);
  return {
    token,
    attempted: attempted.toString(),
    max_per_day: max.toString(),
    remaining: max > attempted ? (max - attempted).toString() : "0",
  };
}
