-- Encrypted fulfillment payloads for physical-goods and delivery flows.
-- Payloads are canonical JSON envelopes containing ciphertext and encryption metadata.

CREATE TABLE IF NOT EXISTS fulfillment_payload_documents (
  payload_hash       TEXT PRIMARY KEY,
  merchant_id        NUMERIC,
  agent              TEXT NOT NULL DEFAULT '',
  quote_hash         TEXT NOT NULL DEFAULT '',
  encryption         TEXT NOT NULL DEFAULT '',
  merchant_key_id    TEXT NOT NULL DEFAULT '',
  payload_text       TEXT NOT NULL,
  size_bytes         INTEGER NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fulfillment_payload_documents_merchant ON fulfillment_payload_documents (merchant_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_payload_documents_agent ON fulfillment_payload_documents (agent);
CREATE INDEX IF NOT EXISTS idx_fulfillment_payload_documents_quote_hash ON fulfillment_payload_documents (quote_hash);
CREATE INDEX IF NOT EXISTS idx_fulfillment_payload_documents_key_id ON fulfillment_payload_documents (merchant_key_id);
