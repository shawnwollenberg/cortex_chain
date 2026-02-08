import { Router } from "express";
import type pg from "pg";
import { isValidTxHash } from "../utils.js";

interface EventSummary {
  eventName?: string;
  args?: Record<string, string>;
  raw?: boolean;
}

function describeEvent(event: EventSummary): string {
  if (!event.eventName || !event.args) return "Unknown event";

  const { eventName, args } = event;
  switch (eventName) {
    case "AgentRegistered":
      return `Agent #${args.agentId} registered by ${args.owner}`;
    case "AgentUpdated":
      return `Agent #${args.agentId} metadata updated`;
    case "AgentRevoked":
      return `Agent #${args.agentId} revoked`;
    case "IntentSubmitted":
      return `Intent #${args.intentId} submitted by ${args.owner}`;
    case "IntentFilled":
      return `Intent #${args.intentId} filled by solver ${args.solver} (in: ${args.amountIn}, out: ${args.amountOut})`;
    case "IntentCancelled":
      return `Intent #${args.intentId} cancelled`;
    case "SpendLimitSet":
      return `Spend limit set for token ${args.token}: ${args.limit}/day`;
    case "TargetAllowlistUpdated":
      return `Target ${args.target} allowlist ${args.allowed === "true" ? "added" : "removed"}`;
    case "FunctionAllowlistUpdated":
      return `Function ${args.selector} on ${args.target} ${args.allowed === "true" ? "allowed" : "disallowed"}`;
    case "SpendRecorded":
      return `Spent ${args.amount} of token ${args.token} (daily total: ${args.dailyTotal})`;
    case "AttestationSubmitted":
      return `Attestation #${args.id} submitted by ${args.attester} (schema: ${args.schema})`;
    case "AttestationRevoked":
      return `Attestation #${args.id} revoked`;
    default:
      return `${eventName} event`;
  }
}

export function createTxRouter(pool: pg.Pool): Router {
  const router = Router();

  // GET /tx/:hash/explain
  router.get("/:hash/explain", async (req, res, next) => {
    try {
      const { hash } = req.params;
      if (!isValidTxHash(hash)) {
        res.status(400).json({ error: "Invalid transaction hash" });
        return;
      }

      const normalizedHash = hash.toLowerCase();
      const result = await pool.query("SELECT * FROM tx_receipts WHERE tx_hash = $1", [normalizedHash]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Transaction not found" });
        return;
      }

      const row = result.rows[0];
      const events = (row.events as EventSummary[]).map((event) => ({
        ...event,
        description: describeEvent(event),
      }));

      const summary = events
        .map((e) => e.description)
        .filter((d) => d !== "Unknown event")
        .join("; ");

      res.json({
        tx_hash: row.tx_hash,
        block_number: row.block_number,
        from_address: row.from_address,
        to_address: row.to_address,
        summary: summary || "No decoded events",
        events,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
