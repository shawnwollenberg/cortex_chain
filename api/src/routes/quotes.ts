import { Router } from "express";
import type { Request } from "express";
import type pg from "pg";
import { parseCanonicalJsonDocument } from "../canonical-json.js";
import { isValidAddress, isValidId } from "../utils.js";

const MAX_QUOTE_DOCUMENT_BYTES = 128 * 1024;

function isBytes32(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

function publicBaseUrl(req: Request): string {
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "";
  return `${proto}://${host}`;
}

function readOptionalId(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  const id = String(value);
  if (!isValidId(id)) throw new Error(`${label} must be a positive integer string`);
  return id;
}

function stringField(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function createQuotesRouter(pool: pg.Pool): Router {
  const router = Router();

  router.post("/quote-requests", async (req, res, next) => {
    try {
      let document;
      try {
        document = parseCanonicalJsonDocument(req.body?.quote_request_json, "quote_request_json", MAX_QUOTE_DOCUMENT_BYTES);
      } catch (error) {
        res.status(error instanceof SyntaxError ? 400 : 400).json({ error: error instanceof Error ? error.message : "Invalid quote_request_json" });
        return;
      }

      const expectedHash = typeof req.body?.expected_hash === "string" ? req.body.expected_hash.toLowerCase() : "";
      if (expectedHash && !isBytes32(expectedHash)) {
        res.status(400).json({ error: "expected_hash must be bytes32" });
        return;
      }

      let merchantId: string | null;
      let serviceNumericId: string | null;
      try {
        merchantId = readOptionalId(req.body?.merchant_id ?? document.parsed.merchant_id, "merchant_id");
        serviceNumericId = readOptionalId(req.body?.service_numeric_id ?? document.parsed.service_numeric_id, "service_numeric_id");
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Invalid id" });
        return;
      }

      const requestId = stringField(req.body?.request_id ?? document.parsed.request_id, 160);
      const serviceId = stringField(req.body?.service_id ?? document.parsed.service_id, 160);
      const agent = stringField(req.body?.agent ?? document.parsed.agent, 42).toLowerCase();
      if (agent && !isValidAddress(agent)) {
        res.status(400).json({ error: "agent must be a valid address" });
        return;
      }

      const requestHash = document.hash;
      if (expectedHash && expectedHash !== requestHash) {
        res.status(409).json({ error: "expected_hash does not match quote_request_json", request_hash: requestHash });
        return;
      }

      const result = await pool.query(
        `INSERT INTO quote_request_documents
          (request_hash, request_id, merchant_id, service_numeric_id, service_id, agent, request_text, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (request_hash) DO UPDATE
         SET request_id = EXCLUDED.request_id,
             merchant_id = EXCLUDED.merchant_id,
             service_numeric_id = EXCLUDED.service_numeric_id,
             service_id = EXCLUDED.service_id,
             agent = EXCLUDED.agent,
             request_text = EXCLUDED.request_text,
             size_bytes = EXCLUDED.size_bytes,
             updated_at = now()
         RETURNING request_hash, request_id, merchant_id, service_numeric_id, service_id, agent, size_bytes, created_at, updated_at`,
        [requestHash, requestId, merchantId, serviceNumericId, serviceId, agent, document.text, document.sizeBytes],
      );

      res.status(201).json({
        ...result.rows[0],
        uri: `${publicBaseUrl(req)}/quote-requests/${requestHash}`,
        canonical_json: document.text,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/quote-requests/:hash", async (req, res, next) => {
    try {
      const hash = req.params.hash.toLowerCase();
      if (!isBytes32(hash)) {
        res.status(400).json({ error: "Invalid quote request hash" });
        return;
      }
      const result = await pool.query("SELECT request_text FROM quote_request_documents WHERE request_hash = $1", [hash]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Quote request not found" });
        return;
      }
      res.type("application/json").send(result.rows[0].request_text);
    } catch (err) {
      next(err);
    }
  });

  router.get("/quote-requests/:hash/metadata", async (req, res, next) => {
    try {
      const hash = req.params.hash.toLowerCase();
      if (!isBytes32(hash)) {
        res.status(400).json({ error: "Invalid quote request hash" });
        return;
      }
      const result = await pool.query(
        `SELECT request_hash, request_id, merchant_id, service_numeric_id, service_id, agent, size_bytes, created_at, updated_at
         FROM quote_request_documents
         WHERE request_hash = $1`,
        [hash],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Quote request not found" });
        return;
      }
      res.json({ ...result.rows[0], uri: `${publicBaseUrl(req)}/quote-requests/${hash}` });
    } catch (err) {
      next(err);
    }
  });

  router.post("/quote-responses", async (req, res, next) => {
    try {
      let document;
      try {
        document = parseCanonicalJsonDocument(req.body?.quote_response_json, "quote_response_json", MAX_QUOTE_DOCUMENT_BYTES);
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Invalid quote_response_json" });
        return;
      }

      const expectedHash = typeof req.body?.expected_hash === "string" ? req.body.expected_hash.toLowerCase() : "";
      const requestHash = stringField(req.body?.request_hash, 66).toLowerCase();
      const quoteHash = stringField(req.body?.quote_hash ?? document.parsed.quote_hash, 66).toLowerCase();
      if (expectedHash && !isBytes32(expectedHash)) {
        res.status(400).json({ error: "expected_hash must be bytes32" });
        return;
      }
      if (requestHash && !isBytes32(requestHash)) {
        res.status(400).json({ error: "request_hash must be bytes32" });
        return;
      }
      if (quoteHash && !isBytes32(quoteHash)) {
        res.status(400).json({ error: "quote_hash must be bytes32" });
        return;
      }

      let merchantId: string | null;
      let serviceNumericId: string | null;
      try {
        const quote = document.parsed.quote && typeof document.parsed.quote === "object"
          ? document.parsed.quote as Record<string, unknown>
          : {};
        merchantId = readOptionalId(req.body?.merchant_id ?? quote.merchantId ?? quote.merchant_id, "merchant_id");
        serviceNumericId = readOptionalId(req.body?.service_numeric_id ?? quote.serviceNumericId ?? quote.service_numeric_id, "service_numeric_id");
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Invalid id" });
        return;
      }

      const requestId = stringField(req.body?.request_id ?? document.parsed.request_id, 160);
      const quote = document.parsed.quote && typeof document.parsed.quote === "object"
        ? document.parsed.quote as Record<string, unknown>
        : {};
      const agent = stringField(req.body?.agent ?? quote.agent, 42).toLowerCase();
      if (agent && !isValidAddress(agent)) {
        res.status(400).json({ error: "agent must be a valid address" });
        return;
      }

      const responseHash = document.hash;
      if (expectedHash && expectedHash !== responseHash) {
        res.status(409).json({ error: "expected_hash does not match quote_response_json", response_hash: responseHash });
        return;
      }

      const result = await pool.query(
        `INSERT INTO quote_response_documents
          (response_hash, request_hash, request_id, quote_hash, merchant_id, service_numeric_id, agent, response_text, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (response_hash) DO UPDATE
         SET request_hash = EXCLUDED.request_hash,
             request_id = EXCLUDED.request_id,
             quote_hash = EXCLUDED.quote_hash,
             merchant_id = EXCLUDED.merchant_id,
             service_numeric_id = EXCLUDED.service_numeric_id,
             agent = EXCLUDED.agent,
             response_text = EXCLUDED.response_text,
             size_bytes = EXCLUDED.size_bytes,
             updated_at = now()
         RETURNING response_hash, request_hash, request_id, quote_hash, merchant_id, service_numeric_id, agent, size_bytes, created_at, updated_at`,
        [responseHash, requestHash || null, requestId, quoteHash, merchantId, serviceNumericId, agent, document.text, document.sizeBytes],
      );

      res.status(201).json({
        ...result.rows[0],
        uri: `${publicBaseUrl(req)}/quote-responses/${responseHash}`,
        canonical_json: document.text,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/quote-responses/:hash", async (req, res, next) => {
    try {
      const hash = req.params.hash.toLowerCase();
      if (!isBytes32(hash)) {
        res.status(400).json({ error: "Invalid quote response hash" });
        return;
      }
      const result = await pool.query("SELECT response_text FROM quote_response_documents WHERE response_hash = $1", [hash]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Quote response not found" });
        return;
      }
      res.type("application/json").send(result.rows[0].response_text);
    } catch (err) {
      next(err);
    }
  });

  router.get("/quote-responses/:hash/metadata", async (req, res, next) => {
    try {
      const hash = req.params.hash.toLowerCase();
      if (!isBytes32(hash)) {
        res.status(400).json({ error: "Invalid quote response hash" });
        return;
      }
      const result = await pool.query(
        `SELECT response_hash, request_hash, request_id, quote_hash, merchant_id, service_numeric_id, agent, size_bytes, created_at, updated_at
         FROM quote_response_documents
         WHERE response_hash = $1`,
        [hash],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Quote response not found" });
        return;
      }
      res.json({ ...result.rows[0], uri: `${publicBaseUrl(req)}/quote-responses/${hash}` });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
