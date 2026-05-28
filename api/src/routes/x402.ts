import { Router } from "express";
import { normalizeX402Requirement } from "../x402.js";

function isBytes32(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

export function createX402Router(): Router {
  const router = Router();

  router.post("/x402/normalize", (req, res) => {
    try {
      const input = req.body?.payment_requirement_json;
      const expectedHash = typeof req.body?.expected_hash === "string" ? req.body.expected_hash.toLowerCase() : "";
      const quoteHash = typeof req.body?.quote?.x402_payload_hash === "string"
        ? req.body.quote.x402_payload_hash.toLowerCase()
        : "";

      if (expectedHash && !isBytes32(expectedHash)) {
        res.status(400).json({ error: "expected_hash must be bytes32" });
        return;
      }
      if (quoteHash && !isBytes32(quoteHash)) {
        res.status(400).json({ error: "quote.x402_payload_hash must be bytes32" });
        return;
      }

      const result = normalizeX402Requirement(input);
      if (expectedHash && expectedHash !== result.payloadHash) {
        res.status(409).json({
          error: "expected_hash does not match normalized x402 payment requirement",
          x402_payload_hash: result.payloadHash,
          canonical_json: result.canonicalJson,
          normalized: result.normalized,
          warnings: result.warnings,
        });
        return;
      }

      res.json({
        normalized: result.normalized,
        canonical_json: result.canonicalJson,
        x402_payload_hash: result.payloadHash,
        matches_expected_hash: expectedHash ? expectedHash === result.payloadHash : null,
        matches_quote_hash: quoteHash ? quoteHash === result.payloadHash : null,
        warnings: result.warnings,
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid x402 payment requirement" });
    }
  });

  return router;
}
