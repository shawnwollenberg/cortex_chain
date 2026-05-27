import { Router } from "express";
import type { Request } from "express";
import type pg from "pg";
import { parseCanonicalJsonDocument } from "../canonical-json.js";
import { isValidAddress, isValidId } from "../utils.js";

const MAX_FULFILLMENT_PAYLOAD_BYTES = 128 * 1024;

function isBytes32(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

function publicBaseUrl(req: Request): string {
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "";
  return `${proto}://${host}`;
}

function stringField(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function readOptionalId(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  const id = String(value);
  if (!isValidId(id)) throw new Error(`${label} must be a positive integer string`);
  return id;
}

export function createFulfillmentRouter(pool: pg.Pool): Router {
  const router = Router();

  router.post("/fulfillment-payloads", async (req, res, next) => {
    try {
      let document;
      try {
        document = parseCanonicalJsonDocument(
          req.body?.fulfillment_payload_json,
          "fulfillment_payload_json",
          MAX_FULFILLMENT_PAYLOAD_BYTES,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid fulfillment_payload_json";
        res.status(message.includes("exceeds") ? 413 : 400).json({ error: message });
        return;
      }

      const expectedHash = typeof req.body?.expected_hash === "string" ? req.body.expected_hash.toLowerCase() : "";
      if (expectedHash && !isBytes32(expectedHash)) {
        res.status(400).json({ error: "expected_hash must be bytes32" });
        return;
      }

      let merchantId: string | null;
      try {
        merchantId = readOptionalId(req.body?.merchant_id ?? document.parsed.merchant_id, "merchant_id");
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Invalid merchant_id" });
        return;
      }

      const agent = stringField(req.body?.agent ?? document.parsed.agent, 42).toLowerCase();
      const quoteHash = stringField(req.body?.quote_hash ?? document.parsed.quote_hash, 66).toLowerCase();
      const encryption = stringField(req.body?.encryption ?? document.parsed.encryption, 120);
      const merchantKeyId = stringField(req.body?.merchant_key_id ?? document.parsed.merchant_key_id, 220);

      if (agent && !isValidAddress(agent)) {
        res.status(400).json({ error: "agent must be a valid address" });
        return;
      }
      if (quoteHash && !isBytes32(quoteHash)) {
        res.status(400).json({ error: "quote_hash must be bytes32" });
        return;
      }
      if (!encryption) {
        res.status(400).json({ error: "encryption is required" });
        return;
      }
      if (!merchantKeyId) {
        res.status(400).json({ error: "merchant_key_id is required" });
        return;
      }

      const payloadHash = document.hash;
      if (expectedHash && expectedHash !== payloadHash) {
        res.status(409).json({ error: "expected_hash does not match fulfillment_payload_json", payload_hash: payloadHash });
        return;
      }

      const result = await pool.query(
        `INSERT INTO fulfillment_payload_documents
          (payload_hash, merchant_id, agent, quote_hash, encryption, merchant_key_id, payload_text, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (payload_hash) DO UPDATE
         SET merchant_id = EXCLUDED.merchant_id,
             agent = EXCLUDED.agent,
             quote_hash = EXCLUDED.quote_hash,
             encryption = EXCLUDED.encryption,
             merchant_key_id = EXCLUDED.merchant_key_id,
             payload_text = EXCLUDED.payload_text,
             size_bytes = EXCLUDED.size_bytes,
             updated_at = now()
         RETURNING payload_hash, merchant_id, agent, quote_hash, encryption, merchant_key_id, size_bytes, created_at, updated_at`,
        [payloadHash, merchantId, agent, quoteHash, encryption, merchantKeyId, document.text, document.sizeBytes],
      );

      res.status(201).json({
        ...result.rows[0],
        uri: `${publicBaseUrl(req)}/fulfillment-payloads/${payloadHash}`,
        canonical_json: document.text,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/fulfillment-payloads/:hash", async (req, res, next) => {
    try {
      const hash = req.params.hash.toLowerCase();
      if (!isBytes32(hash)) {
        res.status(400).json({ error: "Invalid fulfillment payload hash" });
        return;
      }
      const result = await pool.query("SELECT payload_text FROM fulfillment_payload_documents WHERE payload_hash = $1", [hash]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Fulfillment payload not found" });
        return;
      }
      res.type("application/json").send(result.rows[0].payload_text);
    } catch (err) {
      next(err);
    }
  });

  router.get("/fulfillment-payloads/:hash/metadata", async (req, res, next) => {
    try {
      const hash = req.params.hash.toLowerCase();
      if (!isBytes32(hash)) {
        res.status(400).json({ error: "Invalid fulfillment payload hash" });
        return;
      }
      const result = await pool.query(
        `SELECT payload_hash, merchant_id, agent, quote_hash, encryption, merchant_key_id, size_bytes, created_at, updated_at
         FROM fulfillment_payload_documents
         WHERE payload_hash = $1`,
        [hash],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Fulfillment payload not found" });
        return;
      }
      res.json({ ...result.rows[0], uri: `${publicBaseUrl(req)}/fulfillment-payloads/${hash}` });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
