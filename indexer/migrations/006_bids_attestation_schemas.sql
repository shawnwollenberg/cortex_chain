-- Offchain solver market and human-usable attestation schema catalog.

CREATE TABLE IF NOT EXISTS solver_bids (
  bid_id             BIGSERIAL PRIMARY KEY,
  chain_bid_id       NUMERIC,
  intent_id          NUMERIC NOT NULL REFERENCES intents(intent_id) ON DELETE CASCADE,
  solver             TEXT NOT NULL,
  amount_in          NUMERIC NOT NULL,
  amount_out         NUMERIC NOT NULL,
  fee                NUMERIC NOT NULL DEFAULT 0,
  valid_until        NUMERIC NOT NULL,
  execution_plan     JSONB NOT NULL DEFAULT '{}'::jsonb,
  status             TEXT NOT NULL DEFAULT 'OPEN',
  selected_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_solver_bids_intent_chain_bid
  ON solver_bids (intent_id, chain_bid_id)
  WHERE chain_bid_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_solver_bids_intent_id ON solver_bids (intent_id);
CREATE INDEX IF NOT EXISTS idx_solver_bids_solver ON solver_bids (solver);
CREATE INDEX IF NOT EXISTS idx_solver_bids_status ON solver_bids (status);

CREATE TABLE IF NOT EXISTS attestation_schemas (
  schema_hash         TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  json_schema         JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommended_subject TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO attestation_schemas (schema_hash, name, description, json_schema, recommended_subject)
VALUES
  (
    '0x1111111111111111111111111111111111111111111111111111111111111111',
    'solver_reputation',
    'Attests that a solver has met operator reputation or review requirements.',
    '{"type":"object","required":["score","issuer"],"properties":{"score":{"type":"number"},"issuer":{"type":"string"},"notes":{"type":"string"}}}'::jsonb,
    'solver operator address encoded offchain as bytes32'
  ),
  (
    '0x2222222222222222222222222222222222222222222222222222222222222222',
    'tool_capability',
    'Attests that an agent, solver, or tool can perform a named capability.',
    '{"type":"object","required":["capability"],"properties":{"capability":{"type":"string"},"version":{"type":"string"},"evidence_uri":{"type":"string"}}}'::jsonb,
    'keccak256(tool or capability identifier)'
  ),
  (
    '0x3333333333333333333333333333333333333333333333333333333333333333',
    'model_provider',
    'Attests to the model or provider used for a decision or execution plan.',
    '{"type":"object","required":["provider","model"],"properties":{"provider":{"type":"string"},"model":{"type":"string"},"policy_uri":{"type":"string"}}}'::jsonb,
    'keccak256(provider:model)'
  ),
  (
    '0x4444444444444444444444444444444444444444444444444444444444444444',
    'safety_review',
    'Attests that an action or agent passed a safety, compliance, or policy review.',
    '{"type":"object","required":["verdict"],"properties":{"verdict":{"type":"string"},"reviewer":{"type":"string"},"expires_at":{"type":"string"}}}'::jsonb,
    'keccak256(intent hash or agent id)'
  )
ON CONFLICT (schema_hash) DO NOTHING;
