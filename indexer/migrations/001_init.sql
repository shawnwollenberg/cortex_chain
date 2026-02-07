-- Indexer schema: Phase 4

CREATE TABLE IF NOT EXISTS agents (
  agent_id       NUMERIC PRIMARY KEY,
  owner          TEXT NOT NULL,
  metadata_uri   TEXT NOT NULL DEFAULT '',
  pubkey         TEXT NOT NULL DEFAULT '',
  capabilities_hash TEXT NOT NULL DEFAULT '',
  revoked        BOOLEAN NOT NULL DEFAULT FALSE,
  block_number   BIGINT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents (owner);

CREATE TABLE IF NOT EXISTS intents (
  intent_id      NUMERIC PRIMARY KEY,
  owner          TEXT NOT NULL,
  intent_type    SMALLINT NOT NULL DEFAULT 0,
  input_token    TEXT NOT NULL,
  output_token   TEXT NOT NULL,
  amount_in_max  NUMERIC NOT NULL,
  amount_out_min NUMERIC NOT NULL,
  deadline       NUMERIC NOT NULL,
  slippage_bps   INTEGER NOT NULL,
  nonce          NUMERIC NOT NULL,
  status         TEXT NOT NULL DEFAULT 'OPEN',
  block_number   BIGINT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intents_owner ON intents (owner);
CREATE INDEX IF NOT EXISTS idx_intents_status ON intents (status);

CREATE TABLE IF NOT EXISTS fills (
  id             SERIAL PRIMARY KEY,
  intent_id      NUMERIC NOT NULL REFERENCES intents(intent_id),
  solver         TEXT NOT NULL,
  amount_in      NUMERIC NOT NULL,
  amount_out     NUMERIC NOT NULL,
  tx_hash        TEXT NOT NULL,
  block_number   BIGINT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fills_intent_id ON fills (intent_id);

CREATE TABLE IF NOT EXISTS policies (
  id             SERIAL PRIMARY KEY,
  account        TEXT NOT NULL,
  policy_type    TEXT NOT NULL,
  token          TEXT,
  target         TEXT,
  selector       TEXT,
  value          TEXT NOT NULL,
  block_number   BIGINT NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account, policy_type, token, target, selector)
);

CREATE INDEX IF NOT EXISTS idx_policies_account ON policies (account);

CREATE TABLE IF NOT EXISTS tx_receipts (
  tx_hash        TEXT PRIMARY KEY,
  block_number   BIGINT NOT NULL,
  from_address   TEXT NOT NULL,
  to_address     TEXT,
  events         JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS indexer_state (
  key            TEXT PRIMARY KEY,
  value          TEXT NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
