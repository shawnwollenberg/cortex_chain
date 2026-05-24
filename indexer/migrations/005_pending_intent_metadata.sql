-- Pending metadata lets clients publish execution requirements before the
-- on-chain IntentSubmitted event is indexed.

CREATE TABLE IF NOT EXISTS pending_intent_metadata (
  intent_hash                    TEXT PRIMARY KEY,
  owner                          TEXT NOT NULL,
  intent_id                      NUMERIC UNIQUE REFERENCES intents(intent_id) ON DELETE SET NULL,
  execution_target               TEXT,
  execution_data                 TEXT,
  required_attestation_subject   TEXT,
  required_attestation_schema    TEXT,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_intent_metadata_owner
  ON pending_intent_metadata (owner);

CREATE INDEX IF NOT EXISTS idx_pending_intent_metadata_intent_id
  ON pending_intent_metadata (intent_id);
