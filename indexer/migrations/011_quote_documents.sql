-- Hosted quote coordination documents. These records let agents and merchants
-- exchange exact quote request/response JSON while preserving hash verifiability.

CREATE TABLE IF NOT EXISTS quote_request_documents (
  request_hash       TEXT PRIMARY KEY,
  request_id         TEXT NOT NULL DEFAULT '',
  merchant_id        NUMERIC,
  service_numeric_id NUMERIC,
  service_id         TEXT NOT NULL DEFAULT '',
  agent              TEXT NOT NULL DEFAULT '',
  request_text       TEXT NOT NULL,
  size_bytes         INTEGER NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_request_documents_request_id ON quote_request_documents (request_id);
CREATE INDEX IF NOT EXISTS idx_quote_request_documents_merchant ON quote_request_documents (merchant_id);
CREATE INDEX IF NOT EXISTS idx_quote_request_documents_agent ON quote_request_documents (agent);

CREATE TABLE IF NOT EXISTS quote_response_documents (
  response_hash      TEXT PRIMARY KEY,
  request_hash       TEXT,
  request_id         TEXT NOT NULL DEFAULT '',
  quote_hash         TEXT NOT NULL DEFAULT '',
  merchant_id        NUMERIC,
  service_numeric_id NUMERIC,
  agent              TEXT NOT NULL DEFAULT '',
  response_text      TEXT NOT NULL,
  size_bytes         INTEGER NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_response_documents_request_hash ON quote_response_documents (request_hash);
CREATE INDEX IF NOT EXISTS idx_quote_response_documents_request_id ON quote_response_documents (request_id);
CREATE INDEX IF NOT EXISTS idx_quote_response_documents_quote_hash ON quote_response_documents (quote_hash);
CREATE INDEX IF NOT EXISTS idx_quote_response_documents_merchant ON quote_response_documents (merchant_id);
CREATE INDEX IF NOT EXISTS idx_quote_response_documents_agent ON quote_response_documents (agent);
