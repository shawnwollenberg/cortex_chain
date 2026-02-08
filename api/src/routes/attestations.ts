import { Router } from "express";
import type pg from "pg";
import { parsePagination, isValidId, isValidAddress } from "../utils.js";

export function createAttestationsRouter(pool: pg.Pool): Router {
  const router = Router();

  // GET /attestations/:id
  router.get("/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isValidId(id)) {
        res.status(400).json({ error: "Invalid attestation ID" });
        return;
      }

      const result = await pool.query(
        "SELECT * FROM attestations WHERE attestation_id = $1",
        [id],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Attestation not found" });
        return;
      }

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // GET /attestations?schema=&subject=&attester=
  router.get("/", async (req, res, next) => {
    try {
      const schema = req.query.schema as string | undefined;
      const subject = req.query.subject as string | undefined;
      const attester = req.query.attester as string | undefined;

      if (!schema && !subject && !attester) {
        res.status(400).json({ error: "At least one query parameter (schema, subject, attester) is required" });
        return;
      }

      if (attester && !isValidAddress(attester)) {
        res.status(400).json({ error: "Invalid attester address" });
        return;
      }

      const { limit, offset } = parsePagination(req.query);

      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (schema) {
        conditions.push(`schema_hash = $${paramIndex++}`);
        params.push(schema);
      }
      if (subject) {
        conditions.push(`subject = $${paramIndex++}`);
        params.push(subject);
      }
      if (attester) {
        conditions.push(`attester = $${paramIndex++}`);
        params.push(attester.toLowerCase());
      }

      const whereClause = conditions.join(" AND ");
      params.push(limit, offset);

      const result = await pool.query(
        `SELECT * FROM attestations WHERE ${whereClause} ORDER BY attestation_id LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        params,
      );

      res.json({
        attestations: result.rows,
        pagination: { limit, offset, count: result.rows.length },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
