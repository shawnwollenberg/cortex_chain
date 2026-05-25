-- Agentic commerce primitives: merchants, services, facilitators, quotes, receipts, disputes.

CREATE TABLE IF NOT EXISTS merchants (
  merchant_id    NUMERIC PRIMARY KEY,
  owner          TEXT NOT NULL,
  payout_address TEXT NOT NULL,
  metadata_uri   TEXT NOT NULL DEFAULT '',
  metadata_hash  TEXT NOT NULL DEFAULT '',
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  block_number   BIGINT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchants_owner ON merchants (owner);
CREATE INDEX IF NOT EXISTS idx_merchants_active ON merchants (active);

CREATE TABLE IF NOT EXISTS services (
  service_numeric_id NUMERIC PRIMARY KEY,
  merchant_id        NUMERIC NOT NULL REFERENCES merchants(merchant_id),
  service_id         TEXT NOT NULL,
  metadata_uri       TEXT NOT NULL DEFAULT '',
  metadata_hash      TEXT NOT NULL DEFAULT '',
  capability_hash    TEXT NOT NULL DEFAULT '',
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  block_number       BIGINT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_merchant ON services (merchant_id);
CREATE INDEX IF NOT EXISTS idx_services_capability ON services (capability_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_services_merchant_service_id ON services (merchant_id, service_id);

CREATE TABLE IF NOT EXISTS facilitators (
  facilitator_id NUMERIC PRIMARY KEY,
  facilitator    TEXT NOT NULL UNIQUE,
  metadata_uri   TEXT NOT NULL DEFAULT '',
  metadata_hash  TEXT NOT NULL DEFAULT '',
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  block_number   BIGINT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotes (
  quote_hash         TEXT PRIMARY KEY,
  merchant_id        NUMERIC NOT NULL REFERENCES merchants(merchant_id),
  service_numeric_id NUMERIC NOT NULL REFERENCES services(service_numeric_id),
  agent              TEXT NOT NULL,
  token              TEXT NOT NULL,
  facilitator        TEXT NOT NULL,
  amount             NUMERIC NOT NULL,
  payment_rail       INTEGER NOT NULL DEFAULT 0,
  protocol_fee_bps   INTEGER NOT NULL DEFAULT 0,
  protocol_fee_amount NUMERIC NOT NULL DEFAULT 0,
  expires_at         NUMERIC NOT NULL,
  payment_nonce      NUMERIC NOT NULL DEFAULT 0,
  resource_hash      TEXT NOT NULL,
  terms_hash         TEXT NOT NULL,
  x402_payload_hash  TEXT NOT NULL DEFAULT '',
  settled            BOOLEAN NOT NULL DEFAULT FALSE,
  block_number       BIGINT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_agent ON quotes (agent);
CREATE INDEX IF NOT EXISTS idx_quotes_merchant ON quotes (merchant_id);

CREATE TABLE IF NOT EXISTS commerce_receipts (
  receipt_id         NUMERIC PRIMARY KEY,
  quote_hash         TEXT NOT NULL REFERENCES quotes(quote_hash),
  agent              TEXT NOT NULL,
  merchant_id        NUMERIC NOT NULL REFERENCES merchants(merchant_id),
  service_numeric_id NUMERIC NOT NULL REFERENCES services(service_numeric_id),
  token              TEXT NOT NULL,
  amount             NUMERIC NOT NULL,
  payment_rail       INTEGER NOT NULL DEFAULT 0,
  protocol_fee_bps   INTEGER NOT NULL DEFAULT 0,
  protocol_fee_amount NUMERIC NOT NULL DEFAULT 0,
  facilitator        TEXT NOT NULL,
  result_hash        TEXT NOT NULL,
  resource_hash      TEXT NOT NULL,
  fulfillment_hash   TEXT NOT NULL DEFAULT '',
  block_number       BIGINT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commerce_receipts_agent ON commerce_receipts (agent);
CREATE INDEX IF NOT EXISTS idx_commerce_receipts_merchant ON commerce_receipts (merchant_id);

CREATE TABLE IF NOT EXISTS disputes (
  dispute_id     NUMERIC PRIMARY KEY,
  receipt_id     NUMERIC NOT NULL REFERENCES commerce_receipts(receipt_id),
  opener         TEXT NOT NULL,
  reason_hash    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'OPEN',
  resolution_hash TEXT NOT NULL DEFAULT '',
  block_number   BIGINT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_receipt ON disputes (receipt_id);

CREATE TABLE IF NOT EXISTS trust_signals (
  signal_id    NUMERIC PRIMARY KEY,
  subject_type INTEGER NOT NULL,
  subject_id   NUMERIC NOT NULL,
  kind         INTEGER NOT NULL,
  reporter     TEXT NOT NULL,
  signal_hash  TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trust_signals_subject ON trust_signals (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_trust_signals_kind ON trust_signals (kind);
CREATE INDEX IF NOT EXISTS idx_trust_signals_reporter ON trust_signals (reporter);
