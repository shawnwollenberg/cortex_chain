import { Router } from "express";
import type { Request } from "express";
import type pg from "pg";
import { parseCanonicalJsonDocument } from "../canonical-json.js";
import { isValidId } from "../utils.js";

const MAX_CATALOG_BYTES = 128 * 1024;

function isBytes32(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

function publicBaseUrl(req: Request): string {
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "";
  return `${proto}://${host}`;
}

export function createCatalogsRouter(pool: pg.Pool): Router {
  const router = Router();

  router.post("/", async (req, res, next) => {
    try {
      const catalogJson = typeof req.body?.catalog_json === "string" ? req.body.catalog_json : "";
      const expectedHash = typeof req.body?.expected_hash === "string" ? req.body.expected_hash.toLowerCase() : "";
      const merchantId = req.body?.merchant_id === undefined || req.body?.merchant_id === null
        ? null
        : String(req.body.merchant_id);
      const serviceId = typeof req.body?.service_id === "string" ? req.body.service_id.trim() : "";

      if (!catalogJson) {
        res.status(400).json({ error: "catalog_json is required" });
        return;
      }
      let document;
      try {
        document = parseCanonicalJsonDocument(catalogJson, "catalog_json", MAX_CATALOG_BYTES);
      } catch (error) {
        const message = error instanceof Error ? error.message : "catalog_json must be valid JSON";
        res.status(message.includes("exceeds") ? 413 : 400).json({ error: message });
        return;
      }
      if (expectedHash && !isBytes32(expectedHash)) {
        res.status(400).json({ error: "expected_hash must be bytes32" });
        return;
      }
      if (merchantId !== null && !isValidId(merchantId)) {
        res.status(400).json({ error: "merchant_id must be a positive integer string" });
        return;
      }
      if (serviceId.length > 160) {
        res.status(400).json({ error: "service_id must be 160 characters or fewer" });
        return;
      }

      const catalogHash = document.hash;
      if (expectedHash && expectedHash !== catalogHash) {
        res.status(409).json({ error: "expected_hash does not match catalog_json", catalog_hash: catalogHash });
        return;
      }

      const result = await pool.query(
        `INSERT INTO catalog_documents (catalog_hash, merchant_id, service_id, catalog_text, size_bytes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (catalog_hash) DO UPDATE
         SET merchant_id = EXCLUDED.merchant_id,
             service_id = EXCLUDED.service_id,
             catalog_text = EXCLUDED.catalog_text,
             size_bytes = EXCLUDED.size_bytes,
             updated_at = now()
         RETURNING catalog_hash, merchant_id, service_id, size_bytes, created_at, updated_at`,
        [catalogHash, merchantId, serviceId, document.text, document.sizeBytes],
      );

      res.status(201).json({
        ...result.rows[0],
        uri: `${publicBaseUrl(req)}/catalogs/${catalogHash}`,
        canonical_json: document.text,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:hash", async (req, res, next) => {
    try {
      const hash = req.params.hash.toLowerCase();
      if (!isBytes32(hash)) {
        res.status(400).json({ error: "Invalid catalog hash" });
        return;
      }
      const result = await pool.query("SELECT catalog_text FROM catalog_documents WHERE catalog_hash = $1", [hash]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Catalog not found" });
        return;
      }
      res.type("application/json").send(result.rows[0].catalog_text);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:hash/metadata", async (req, res, next) => {
    try {
      const hash = req.params.hash.toLowerCase();
      if (!isBytes32(hash)) {
        res.status(400).json({ error: "Invalid catalog hash" });
        return;
      }
      const result = await pool.query(
        `SELECT catalog_hash, merchant_id, service_id, size_bytes, created_at, updated_at
         FROM catalog_documents
         WHERE catalog_hash = $1`,
        [hash],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Catalog not found" });
        return;
      }
      res.json({
        ...result.rows[0],
        uri: `${publicBaseUrl(req)}/catalogs/${hash}`,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
