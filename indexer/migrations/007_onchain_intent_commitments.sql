-- Onchain execution and attestation commitments carried by signed intents.

ALTER TABLE intents
  ADD COLUMN IF NOT EXISTS execution_target TEXT,
  ADD COLUMN IF NOT EXISTS execution_data_hash TEXT,
  ADD COLUMN IF NOT EXISTS required_attestation_subject TEXT,
  ADD COLUMN IF NOT EXISTS required_attestation_schema TEXT,
  ADD COLUMN IF NOT EXISTS metadata_uri_hash TEXT;
