import { Router } from "express";
import type pg from "pg";
import { parsePagination, isValidAddress } from "../utils.js";

export function createPoliciesRouter(pool: pg.Pool): Router {
  const router = Router();

  // GET /accounts/:address/policies
  router.get("/:address/policies", async (req, res, next) => {
    try {
      const { address } = req.params;
      if (!isValidAddress(address)) {
        res.status(400).json({ error: "Invalid address" });
        return;
      }

      const { limit, offset } = parsePagination(req.query);
      const normalizedAddress = address.toLowerCase();

      const result = await pool.query(
        "SELECT * FROM policies WHERE account = $1 ORDER BY policy_type, id LIMIT $2 OFFSET $3",
        [normalizedAddress, limit, offset],
      );

      res.json({
        account: normalizedAddress,
        policies: result.rows,
        pagination: { limit, offset, count: result.rows.length },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
