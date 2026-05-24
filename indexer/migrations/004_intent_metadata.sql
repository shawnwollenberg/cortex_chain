-- Offchain metadata for intent execution and provenance requirements.

CREATE TABLE IF NOT EXISTS intent_metadata (
  intent_id                      NUMERIC PRIMARY KEY REFERENCES intents(intent_id) ON DELETE CASCADE,
  execution_target               TEXT,
  execution_data                 TEXT,
  required_attestation_subject   TEXT,
  required_attestation_schema    TEXT,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intent_metadata_required_attestation_subject
  ON intent_metadata (required_attestation_subject);
