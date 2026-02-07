import { Router } from "express";
import type pg from "pg";
import { parsePagination, isValidAddress, isValidId } from "../utils.js";

export function createAgentsRouter(pool: pg.Pool): Router {
  const router = Router();

  // GET /agents/:agentId
  router.get("/:agentId", async (req, res, next) => {
    try {
      const { agentId } = req.params;
      if (!isValidId(agentId)) {
        res.status(400).json({ error: "Invalid agent ID" });
        return;
      }

      const result = await pool.query("SELECT * FROM agents WHERE agent_id = $1", [agentId]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // GET /agents?owner=0x...
  router.get("/", async (req, res, next) => {
    try {
      const owner = req.query.owner as string | undefined;
      if (!owner) {
        res.status(400).json({ error: "Query parameter 'owner' is required" });
        return;
      }
      if (!isValidAddress(owner)) {
        res.status(400).json({ error: "Invalid owner address" });
        return;
      }

      const { limit, offset } = parsePagination(req.query);
      const normalizedOwner = owner.toLowerCase();

      const result = await pool.query(
        "SELECT * FROM agents WHERE owner = $1 ORDER BY agent_id LIMIT $2 OFFSET $3",
        [normalizedOwner, limit, offset],
      );

      res.json({
        agents: result.rows,
        pagination: { limit, offset, count: result.rows.length },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
