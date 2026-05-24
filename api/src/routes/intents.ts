import { Router } from "express";
import type pg from "pg";
import { parsePagination, isValidAddress, isValidId } from "../utils.js";

const VALID_STATUSES = ["OPEN", "FILLED", "CANCELLED"];
const HEX_32 = /^0x[0-9a-fA-F]{64}$/;
const HEX_BYTES = /^0x[0-9a-fA-F]*$/;

interface IntentMetadataBody {
  execution_target?: string;
  execution_data?: string;
  required_attestation_subject?: string;
  required_attestation_schema?: string;
}

function validateMetadataBody(body: IntentMetadataBody): string | null {
  if (body.execution_target && !isValidAddress(body.execution_target)) {
    return "Invalid execution_target";
  }
  if (body.execution_data && !HEX_BYTES.test(body.execution_data)) {
    return "Invalid execution_data";
  }
  if (body.required_attestation_subject && !HEX_32.test(body.required_attestation_subject)) {
    return "Invalid required_attestation_subject";
  }
  if (body.required_attestation_schema && !HEX_32.test(body.required_attestation_schema)) {
    return "Invalid required_attestation_schema";
  }
  return null;
}

function normalizeMetadataBody(body: IntentMetadataBody): [
  string | null,
  string | null,
  string | null,
  string | null,
] {
  return [
    body.execution_target?.toLowerCase() ?? null,
    body.execution_data?.toLowerCase() ?? null,
    body.required_attestation_subject?.toLowerCase() ?? null,
    body.required_attestation_schema?.toLowerCase() ?? null,
  ];
}

export function createIntentsRouter(pool: pg.Pool): Router {
  const router = Router();

  // GET /intents/:id
  router.get("/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isValidId(id)) {
        res.status(400).json({ error: "Invalid intent ID" });
        return;
      }

      const intentResult = await pool.query("SELECT * FROM intents WHERE intent_id = $1", [id]);
      if (intentResult.rows.length === 0) {
        res.status(404).json({ error: "Intent not found" });
        return;
      }

      const intent = intentResult.rows[0];
      let fill = null;
      const metadataResult = await pool.query(
        "SELECT * FROM intent_metadata WHERE intent_id = $1",
        [id],
      );
      const metadata = metadataResult.rows[0] ?? null;

      if (intent.status === "FILLED") {
        const fillResult = await pool.query(
          "SELECT * FROM fills WHERE intent_id = $1",
          [id],
        );
        if (fillResult.rows.length > 0) {
          fill = fillResult.rows[0];
        }
      }

      res.json({ ...intent, fill, metadata });
    } catch (err) {
      next(err);
    }
  });

  // PUT /intents/:id/metadata
  router.put("/:id/metadata", async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isValidId(id)) {
        res.status(400).json({ error: "Invalid intent ID" });
        return;
      }

      const exists = await pool.query("SELECT intent_id FROM intents WHERE intent_id = $1", [id]);
      if (exists.rows.length === 0) {
        res.status(404).json({ error: "Intent not found" });
        return;
      }

      const validationError = validateMetadataBody(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }
      const [executionTarget, executionData, requiredSubject, requiredSchema] = normalizeMetadataBody(req.body);

      const result = await pool.query(
        `INSERT INTO intent_metadata
          (intent_id, execution_target, execution_data, required_attestation_subject, required_attestation_schema)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (intent_id) DO UPDATE SET
          execution_target = $2,
          execution_data = $3,
          required_attestation_subject = $4,
          required_attestation_schema = $5,
          updated_at = now()
         RETURNING *`,
        [
          id,
          executionTarget,
          executionData,
          requiredSubject,
          requiredSchema,
        ],
      );

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // POST /intents/metadata
  router.post("/metadata", async (req, res, next) => {
    try {
      const intentHash = req.body.intent_hash as string | undefined;
      const owner = req.body.owner as string | undefined;

      if (!intentHash || !HEX_32.test(intentHash)) {
        res.status(400).json({ error: "Invalid intent_hash" });
        return;
      }
      if (!owner || !isValidAddress(owner)) {
        res.status(400).json({ error: "Invalid owner" });
        return;
      }

      const validationError = validateMetadataBody(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }
      const [executionTarget, executionData, requiredSubject, requiredSchema] = normalizeMetadataBody(req.body);

      const result = await pool.query(
        `INSERT INTO pending_intent_metadata
          (intent_hash, owner, execution_target, execution_data, required_attestation_subject, required_attestation_schema)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (intent_hash) DO UPDATE SET
          owner = $2,
          execution_target = $3,
          execution_data = $4,
          required_attestation_subject = $5,
          required_attestation_schema = $6,
          updated_at = now()
         RETURNING *`,
        [
          intentHash.toLowerCase(),
          owner.toLowerCase(),
          executionTarget,
          executionData,
          requiredSubject,
          requiredSchema,
        ],
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // GET /intents/metadata/:intentHash
  router.get("/metadata/:intentHash", async (req, res, next) => {
    try {
      const { intentHash } = req.params;
      if (!HEX_32.test(intentHash)) {
        res.status(400).json({ error: "Invalid intent_hash" });
        return;
      }

      const result = await pool.query(
        "SELECT * FROM pending_intent_metadata WHERE intent_hash = $1",
        [intentHash.toLowerCase()],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Intent metadata not found" });
        return;
      }

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // GET /intents?status=open|filled|cancelled
  router.get("/", async (req, res, next) => {
    try {
      const status = req.query.status as string | undefined;
      const { limit, offset } = parsePagination(req.query);

      if (status) {
        const normalized = status.toUpperCase();
        if (!VALID_STATUSES.includes(normalized)) {
          res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
          return;
        }

        const result = await pool.query(
          "SELECT * FROM intents WHERE status = $1 ORDER BY intent_id DESC LIMIT $2 OFFSET $3",
          [normalized, limit, offset],
        );

        res.json({
          intents: result.rows,
          pagination: { limit, offset, count: result.rows.length },
        });
        return;
      }

      const result = await pool.query(
        "SELECT * FROM intents ORDER BY intent_id DESC LIMIT $1 OFFSET $2",
        [limit, offset],
      );

      res.json({
        intents: result.rows,
        pagination: { limit, offset, count: result.rows.length },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
