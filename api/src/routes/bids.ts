import { Router } from "express";
import type pg from "pg";
import { isValidAddress, isValidId, parsePagination } from "../utils.js";

const BID_STATUSES = ["OPEN", "SELECTED", "REJECTED", "EXPIRED"];

export function createBidsRouter(pool: pg.Pool): Router {
  const router = Router({ mergeParams: true });

  router.post("/intents/:id/bids", async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isValidId(id)) {
        res.status(400).json({ error: "Invalid intent ID" });
        return;
      }

      const solver = String(req.body.solver ?? "").toLowerCase();
      if (!isValidAddress(solver)) {
        res.status(400).json({ error: "Invalid solver address" });
        return;
      }

      const amountIn = parsePositiveNumeric(req.body.amount_in, "amount_in");
      const amountOut = parsePositiveNumeric(req.body.amount_out, "amount_out");
      const fee = parseNonNegativeNumeric(req.body.fee ?? "0", "fee");
      const validUntil = parsePositiveNumeric(req.body.valid_until, "valid_until");
      if ("error" in amountIn) {
        res.status(400).json({ error: amountIn.error });
        return;
      }
      if ("error" in amountOut) {
        res.status(400).json({ error: amountOut.error });
        return;
      }
      if ("error" in fee) {
        res.status(400).json({ error: fee.error });
        return;
      }
      if ("error" in validUntil) {
        res.status(400).json({ error: validUntil.error });
        return;
      }

      const intent = await pool.query("SELECT intent_id, status FROM intents WHERE intent_id = $1", [id]);
      if (intent.rows.length === 0) {
        res.status(404).json({ error: "Intent not found" });
        return;
      }
      if (intent.rows[0].status !== "OPEN") {
        res.status(409).json({ error: "Intent is not open for bids" });
        return;
      }

      const result = await pool.query(
        `INSERT INTO solver_bids
          (intent_id, solver, amount_in, amount_out, fee, valid_until, execution_plan)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          id,
          solver,
          amountIn.value,
          amountOut.value,
          fee.value,
          validUntil.value,
          JSON.stringify(req.body.execution_plan ?? {}),
        ],
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  router.get("/intents/:id/bids", async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isValidId(id)) {
        res.status(400).json({ error: "Invalid intent ID" });
        return;
      }

      const status = req.query.status as string | undefined;
      const { limit, offset } = parsePagination(req.query);
      const params: unknown[] = [id];
      let where = "intent_id = $1";
      let paramIndex = 2;

      if (status) {
        const normalized = status.toUpperCase();
        if (!BID_STATUSES.includes(normalized)) {
          res.status(400).json({ error: `Invalid status. Must be one of: ${BID_STATUSES.join(", ")}` });
          return;
        }
        where += ` AND status = $${paramIndex++}`;
        params.push(normalized);
      }

      params.push(limit, offset);
      const result = await pool.query(
        `SELECT * FROM solver_bids
         WHERE ${where}
         ORDER BY amount_out DESC, amount_in ASC, fee ASC, bid_id ASC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        params,
      );

      res.json({ bids: result.rows, pagination: { limit, offset, count: result.rows.length } });
    } catch (err) {
      next(err);
    }
  });

  router.post("/bids/:bidId/select", async (req, res, next) => {
    try {
      const { bidId } = req.params;
      if (!isValidId(bidId)) {
        res.status(400).json({ error: "Invalid bid ID" });
        return;
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const selected = await client.query(
          `UPDATE solver_bids
           SET status = 'SELECTED', selected_at = now(), updated_at = now()
           WHERE bid_id = $1 AND status = 'OPEN'
           RETURNING *`,
          [bidId],
        );
        if (selected.rows.length === 0) {
          await client.query("ROLLBACK");
          res.status(404).json({ error: "Open bid not found" });
          return;
        }

        await client.query(
          `UPDATE solver_bids
           SET status = 'REJECTED', updated_at = now()
           WHERE intent_id = $1 AND bid_id <> $2 AND status = 'OPEN'`,
          [selected.rows[0].intent_id, bidId],
        );
        await client.query("COMMIT");
        res.json(selected.rows[0]);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      next(err);
    }
  });

  router.get("/bids/:bidId", async (req, res, next) => {
    try {
      const { bidId } = req.params;
      if (!isValidId(bidId)) {
        res.status(400).json({ error: "Invalid bid ID" });
        return;
      }
      const result = await pool.query("SELECT * FROM solver_bids WHERE bid_id = $1", [bidId]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Bid not found" });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function parsePositiveNumeric(value: unknown, field: string): { value: string } | { error: string } {
  const parsed = parseNonNegativeNumeric(value, field);
  if ("error" in parsed) return parsed;
  return BigInt(parsed.value) > 0n ? parsed : { error: `${field} must be greater than zero` };
}

function parseNonNegativeNumeric(value: unknown, field: string): { value: string } | { error: string } {
  const raw = String(value ?? "");
  if (!/^\d+$/.test(raw)) return { error: `${field} must be a non-negative integer string` };
  return { value: BigInt(raw).toString() };
}
