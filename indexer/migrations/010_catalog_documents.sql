-- Hosted service catalog documents. The raw text is stored so its keccak256 hash
-- can be reproduced byte-for-byte by agents before registration or payment.

CREATE TABLE IF NOT EXISTS catalog_documents (
  catalog_hash TEXT PRIMARY KEY,
  merchant_id  NUMERIC,
  service_id   TEXT NOT NULL DEFAULT '',
  catalog_text TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_documents_merchant ON catalog_documents (merchant_id);
CREATE INDEX IF NOT EXISTS idx_catalog_documents_service_id ON catalog_documents (service_id);
