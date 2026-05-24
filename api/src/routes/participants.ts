import { Router } from "express";
import type pg from "pg";
import { parsePagination, isValidAddress, isValidId } from "../utils.js";

export function createParticipantsRouter(pool: pg.Pool): Router {
  const router = Router();

  router.get("/solvers/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isValidId(id)) {
        res.status(400).json({ error: "Invalid solver ID" });
        return;
      }

      const result = await pool.query(
        `SELECT *,
          CASE WHEN fills > 0 THEN total_latency_blocks / fills ELSE 0 END AS avg_latency_blocks,
          CASE WHEN fills > 0 THEN total_surplus_out / fills ELSE 0 END AS avg_surplus_out
         FROM solvers WHERE solver_id = $1`,
        [id],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Solver not found" });
        return;
      }

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  router.get("/solvers", async (req, res, next) => {
    try {
      const operator = req.query.operator as string | undefined;
      const active = req.query.active as string | undefined;
      const { limit, offset } = parsePagination(req.query);

      if (operator && !isValidAddress(operator)) {
        res.status(400).json({ error: "Invalid operator address" });
        return;
      }

      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (operator) {
        conditions.push(`operator = $${paramIndex++}`);
        params.push(operator.toLowerCase());
      }
      if (active !== undefined) {
        if (!["true", "false"].includes(active)) {
          res.status(400).json({ error: "active must be true or false" });
          return;
        }
        conditions.push(`active = $${paramIndex++}`);
        params.push(active === "true");
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      params.push(limit, offset);

      const result = await pool.query(
        `SELECT *,
          CASE WHEN fills > 0 THEN total_latency_blocks / fills ELSE 0 END AS avg_latency_blocks,
          CASE WHEN fills > 0 THEN total_surplus_out / fills ELSE 0 END AS avg_surplus_out
         FROM solvers ${whereClause} ORDER BY solver_id LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        params,
      );

      res.json({
        solvers: result.rows,
        pagination: { limit, offset, count: result.rows.length },
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/attestors/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isValidId(id)) {
        res.status(400).json({ error: "Invalid attestor ID" });
        return;
      }

      const result = await pool.query("SELECT * FROM attestors WHERE attestor_id = $1", [id]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Attestor not found" });
        return;
      }

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  router.get("/attestors", async (req, res, next) => {
    try {
      const operator = req.query.operator as string | undefined;
      const active = req.query.active as string | undefined;
      const { limit, offset } = parsePagination(req.query);

      if (operator && !isValidAddress(operator)) {
        res.status(400).json({ error: "Invalid operator address" });
        return;
      }

      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (operator) {
        conditions.push(`operator = $${paramIndex++}`);
        params.push(operator.toLowerCase());
      }
      if (active !== undefined) {
        if (!["true", "false"].includes(active)) {
          res.status(400).json({ error: "active must be true or false" });
          return;
        }
        conditions.push(`active = $${paramIndex++}`);
        params.push(active === "true");
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      params.push(limit, offset);

      const result = await pool.query(
        `SELECT * FROM attestors ${whereClause} ORDER BY attestor_id LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        params,
      );

      res.json({
        attestors: result.rows,
        pagination: { limit, offset, count: result.rows.length },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
