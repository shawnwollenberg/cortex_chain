-- Solver and attestor registry tables

CREATE TABLE IF NOT EXISTS solvers (
  solver_id          NUMERIC PRIMARY KEY,
  operator           TEXT NOT NULL UNIQUE,
  metadata_uri       TEXT NOT NULL DEFAULT '',
  capabilities_hash  TEXT NOT NULL DEFAULT '',
  bond               NUMERIC NOT NULL DEFAULT 0,
  fills              NUMERIC NOT NULL DEFAULT 0,
  successful_fills   NUMERIC NOT NULL DEFAULT 0,
  failed_fills       NUMERIC NOT NULL DEFAULT 0,
  total_latency_blocks NUMERIC NOT NULL DEFAULT 0,
  total_surplus_out  NUMERIC NOT NULL DEFAULT 0,
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  block_number       BIGINT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solvers_operator ON solvers (operator);
CREATE INDEX IF NOT EXISTS idx_solvers_active ON solvers (active);

CREATE TABLE IF NOT EXISTS attestors (
  attestor_id            NUMERIC PRIMARY KEY,
  operator               TEXT NOT NULL UNIQUE,
  metadata_uri           TEXT NOT NULL DEFAULT '',
  schemas_hash           TEXT NOT NULL DEFAULT '',
  attestations           NUMERIC NOT NULL DEFAULT 0,
  revoked_attestations   NUMERIC NOT NULL DEFAULT 0,
  active                 BOOLEAN NOT NULL DEFAULT TRUE,
  block_number           BIGINT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attestors_operator ON attestors (operator);
CREATE INDEX IF NOT EXISTS idx_attestors_active ON attestors (active);
