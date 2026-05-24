-- Fill execution proof commitments emitted by IntentBook.

ALTER TABLE fills
  ADD COLUMN IF NOT EXISTS result_hash TEXT,
  ADD COLUMN IF NOT EXISTS trace_hash TEXT,
  ADD COLUMN IF NOT EXISTS attestation_id NUMERIC;
