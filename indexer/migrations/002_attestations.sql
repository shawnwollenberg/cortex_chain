-- Attestation registry tables: Phase 8

CREATE TABLE IF NOT EXISTS attestations (
  attestation_id NUMERIC PRIMARY KEY,
  attester       TEXT NOT NULL,
  schema_hash    TEXT NOT NULL,
  subject        TEXT NOT NULL,
  data_hash      TEXT NOT NULL,
  timestamp      BIGINT NOT NULL,
  revoked        BOOLEAN NOT NULL DEFAULT FALSE,
  block_number   BIGINT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attestations_attester ON attestations (attester);
CREATE INDEX IF NOT EXISTS idx_attestations_schema ON attestations (schema_hash);
CREATE INDEX IF NOT EXISTS idx_attestations_subject ON attestations (subject);
