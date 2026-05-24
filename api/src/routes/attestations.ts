import { Router } from "express";
import type pg from "pg";
import { parsePagination, isValidId, isValidAddress } from "../utils.js";

export function createAttestationsRouter(pool: pg.Pool): Router {
  const router = Router();

  router.get("/schemas", async (_req, res, next) => {
    try {
      const result = await pool.query("SELECT * FROM attestation_schemas ORDER BY name");
      res.json({ schemas: result.rows });
    } catch (err) {
      next(err);
    }
  });

  router.get("/schemas/:schemaHash", async (req, res, next) => {
    try {
      const { schemaHash } = req.params;
      if (!/^0x[0-9a-fA-F]{64}$/.test(schemaHash)) {
        res.status(400).json({ error: "Invalid schema hash" });
        return;
      }
      const result = await pool.query(
        "SELECT * FROM attestation_schemas WHERE schema_hash = $1",
        [schemaHash.toLowerCase()],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Attestation schema not found" });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  router.post("/schemas", async (req, res, next) => {
    try {
      const schemaHash = String(req.body.schema_hash ?? "").toLowerCase();
      const name = String(req.body.name ?? "").trim();
      if (!/^0x[0-9a-f]{64}$/.test(schemaHash)) {
        res.status(400).json({ error: "Invalid schema_hash" });
        return;
      }
      if (!name) {
        res.status(400).json({ error: "name is required" });
        return;
      }

      const result = await pool.query(
        `INSERT INTO attestation_schemas
          (schema_hash, name, description, json_schema, recommended_subject)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (schema_hash) DO UPDATE SET
          name = $2,
          description = $3,
          json_schema = $4,
          recommended_subject = $5,
          updated_at = now()
         RETURNING *`,
        [
          schemaHash,
          name,
          String(req.body.description ?? ""),
          JSON.stringify(req.body.json_schema ?? {}),
          String(req.body.recommended_subject ?? ""),
        ],
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

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
