-- Canonical fulfillment evidence documents that can be hash-bound to receipts.
-- These records describe delivery, shipment, completion, refund, or dispute evidence
-- without exposing plaintext fulfillment details onchain.

CREATE TABLE IF NOT EXISTS fulfillment_evidence_documents (
  evidence_hash       TEXT PRIMARY KEY,
  receipt_id          NUMERIC,
  quote_hash          TEXT NOT NULL DEFAULT '',
  payload_hash        TEXT NOT NULL DEFAULT '',
  evidence_type       TEXT NOT NULL DEFAULT '',
  evidence_text       TEXT NOT NULL,
  size_bytes          INTEGER NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fulfillment_evidence_documents_receipt ON fulfillment_evidence_documents (receipt_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_evidence_documents_quote_hash ON fulfillment_evidence_documents (quote_hash);
CREATE INDEX IF NOT EXISTS idx_fulfillment_evidence_documents_payload_hash ON fulfillment_evidence_documents (payload_hash);
CREATE INDEX IF NOT EXISTS idx_fulfillment_evidence_documents_type ON fulfillment_evidence_documents (evidence_type);
