import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { createApp } from "../src/app.js";
import type { Server } from "node:http";
import { keccak256, toBytes } from "viem";

const TEST_DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/ai_chain_test";

let pool: pg.Pool;
let server: Server;
let baseUrl: string;

async function seedTestData(pool: pg.Pool): Promise<void> {
  await pool.query(`
    INSERT INTO agents (agent_id, owner, metadata_uri, pubkey, capabilities_hash, revoked, block_number)
    VALUES
      (1, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'ipfs://meta1', '0xpubkey1', '0xcap1', false, 100),
      (2, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'ipfs://meta2', '0xpubkey2', '0xcap2', false, 101),
      (3, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'ipfs://meta3', '0xpubkey3', '0xcap3', true, 102)
    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    INSERT INTO intents (intent_id, owner, intent_type, input_token, output_token, amount_in_max, amount_out_min, deadline, slippage_bps, nonce, status, block_number)
    VALUES
      (1, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 0, '0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222', 1000, 900, 9999999999, 50, 1, 'OPEN', 200),
      (2, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 0, '0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222', 2000, 1800, 9999999999, 100, 2, 'FILLED', 201),
      (3, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 0, '0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222', 500, 450, 9999999999, 30, 1, 'CANCELLED', 202)
    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    INSERT INTO fills (intent_id, solver, amount_in, amount_out, tx_hash, block_number)
    VALUES
      (2, '0xcccccccccccccccccccccccccccccccccccccccc', 2000, 1850, '0x00000000000000000000000000000000000000000000000000000000deadbeef', 203)
    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    INSERT INTO policies (account, policy_type, token, target, selector, value, block_number)
    VALUES
      ('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'spend_limit', '0x1111111111111111111111111111111111111111', NULL, NULL, '5000', 300),
      ('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'target_allowlist', NULL, '0x3333333333333333333333333333333333333333', NULL, 'true', 301)
    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    INSERT INTO tx_receipts (tx_hash, block_number, from_address, to_address, events)
    VALUES
      ('0x00000000000000000000000000000000000000000000000000000000abcdef01', 400, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
       $1::jsonb)
    ON CONFLICT DO NOTHING
  `, [JSON.stringify([
    { eventName: "AgentRegistered", args: { agentId: "1", owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } },
    { eventName: "IntentSubmitted", args: { intentId: "1", owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } },
  ])]);

  await pool.query(`
    INSERT INTO solvers (solver_id, operator, metadata_uri, capabilities_hash, bond, fills, successful_fills, failed_fills, active, block_number)
    VALUES
      (1, '0xcccccccccccccccccccccccccccccccccccccccc', 'ipfs://solver1', '0xsolvercap1', 1000, 3, 2, 1, true, 500),
      (2, '0xdddddddddddddddddddddddddddddddddddddddd', 'ipfs://solver2', '0xsolvercap2', 0, 0, 0, 0, false, 501)
    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    INSERT INTO attestors (attestor_id, operator, metadata_uri, schemas_hash, attestations, revoked_attestations, active, block_number)
    VALUES
      (1, '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 'ipfs://attestor1', '0xschema1', 5, 1, true, 600),
      (2, '0xffffffffffffffffffffffffffffffffffffffff', 'ipfs://attestor2', '0xschema2', 0, 0, false, 601)
    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    INSERT INTO merchants (merchant_id, owner, payout_address, metadata_uri, metadata_hash, active, block_number)
    VALUES
      (1, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'ipfs://merchant1', $1, true, 700)
    ON CONFLICT DO NOTHING
  `, [`0x${"aa".repeat(32)}`]);

  await pool.query(`
    INSERT INTO services (service_numeric_id, merchant_id, service_id, metadata_uri, metadata_hash, capability_hash, active, block_number)
    VALUES
      (1, 1, 'weather.current', 'ipfs://service1', $1, $2, true, 701)
    ON CONFLICT DO NOTHING
  `, [`0x${"bb".repeat(32)}`, `0x${"cc".repeat(32)}`]);

  await pool.query(`
    INSERT INTO facilitators (facilitator_id, facilitator, metadata_uri, metadata_hash, active, block_number)
    VALUES
      (1, '0xcccccccccccccccccccccccccccccccccccccccc', 'ipfs://facilitator1', $1, true, 702)
    ON CONFLICT DO NOTHING
  `, [`0x${"dd".repeat(32)}`]);

  await pool.query(`
    INSERT INTO quotes
      (quote_hash, merchant_id, service_numeric_id, agent, token, facilitator, amount, protocol_fee_bps,
       protocol_fee_amount, payment_rail, expires_at, payment_nonce, resource_hash, terms_hash, x402_payload_hash, settled,
       block_number)
    VALUES
      ($1, 1, 1, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0x1111111111111111111111111111111111111111',
       '0xcccccccccccccccccccccccccccccccccccccccc', 1000000, 0, 0, 3, 9999999999, 1, $2, $3, $4, true, 703)
    ON CONFLICT DO NOTHING
  `, [`0x${"11".repeat(32)}`, `0x${"22".repeat(32)}`, `0x${"33".repeat(32)}`, `0x${"44".repeat(32)}`]);

  await pool.query(`
    INSERT INTO commerce_receipts
      (receipt_id, quote_hash, agent, merchant_id, service_numeric_id, token, amount, protocol_fee_bps,
       protocol_fee_amount, payment_rail, facilitator, result_hash, resource_hash, fulfillment_hash, block_number)
    VALUES
      (1, $1, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 1, 1,
       '0x1111111111111111111111111111111111111111', 1000000, 0, 0,
       3, '0xcccccccccccccccccccccccccccccccccccccccc', $2, $3, $4, 704)
    ON CONFLICT DO NOTHING
  `, [`0x${"11".repeat(32)}`, `0x${"55".repeat(32)}`, `0x${"22".repeat(32)}`, `0x${"88".repeat(32)}`]);

  await pool.query(`
    INSERT INTO disputes (dispute_id, receipt_id, opener, reason_hash, status, resolution_hash, block_number)
    VALUES
      (1, 1, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', $1, 'RESOLVED', $2, 705)
    ON CONFLICT DO NOTHING
  `, [`0x${"66".repeat(32)}`, `0x${"77".repeat(32)}`]);

  await pool.query(`
    INSERT INTO trust_signals (signal_id, subject_type, subject_id, kind, reporter, signal_hash, block_number)
    VALUES
      (1, 0, 1, 0, '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', $1, 706),
      (2, 0, 1, 1, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', $2, 707)
    ON CONFLICT DO NOTHING
  `, [`0x${"89".repeat(32)}`, `0x${"90".repeat(32)}`]);
}

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });

  // Drop and recreate tables
  await pool.query("DROP TABLE IF EXISTS catalog_documents, disputes, commerce_receipts, quotes, facilitators, services, merchants, solver_bids, attestation_schemas, fills, policies, tx_receipts, pending_intent_metadata, intent_metadata, intents, agents, solvers, attestors, attestations, indexer_state CASCADE");

  // Run migrations (read the SQL file)
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  for (const file of ["001_init.sql", "002_attestations.sql", "003_participants.sql", "004_intent_metadata.sql", "005_pending_intent_metadata.sql", "006_bids_attestation_schemas.sql", "007_onchain_intent_commitments.sql", "008_fill_proofs.sql", "009_commerce.sql", "010_catalog_documents.sql"]) {
    const migrationPath = resolve(__dirname, "..", "..", "indexer", "migrations", file);
    const sql = readFileSync(migrationPath, "utf-8");
    await pool.query(sql);
  }

  await seedTestData(pool);

  const app = createApp(pool);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const addr = server.address();
  if (typeof addr === "object" && addr) {
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (pool) {
    await pool.end();
  }
});

describe("Health", () => {
  it("GET /health returns 200", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});

describe("Agents", () => {
  it("GET /agents/1 returns agent data", async () => {
    const res = await fetch(`${baseUrl}/agents/1`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agent_id).toBe("1");
    expect(body.owner).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });

  it("GET /agents/999 returns 404", async () => {
    const res = await fetch(`${baseUrl}/agents/999`);
    expect(res.status).toBe(404);
  });

  it("GET /agents/abc returns 400", async () => {
    const res = await fetch(`${baseUrl}/agents/abc`);
    expect(res.status).toBe(400);
  });

  it("GET /agents?owner=0x... returns filtered agents", async () => {
    const res = await fetch(`${baseUrl}/agents?owner=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agents).toHaveLength(2);
    expect(body.pagination).toBeDefined();
  });

  it("GET /agents without owner returns 400", async () => {
    const res = await fetch(`${baseUrl}/agents`);
    expect(res.status).toBe(400);
  });
});

describe("Intents", () => {
  it("GET /intents?status=open returns open intents", async () => {
    const res = await fetch(`${baseUrl}/intents?status=open`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intents.length).toBeGreaterThanOrEqual(1);
    expect(body.intents.every((i: { status: string }) => i.status === "OPEN")).toBe(true);
  });

  it("GET /intents returns all intents", async () => {
    const res = await fetch(`${baseUrl}/intents`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intents).toHaveLength(3);
  });

  it("GET /intents?status=invalid returns 400", async () => {
    const res = await fetch(`${baseUrl}/intents?status=invalid`);
    expect(res.status).toBe(400);
  });

  it("GET /intents/2 (filled) returns intent with fill data", async () => {
    const res = await fetch(`${baseUrl}/intents/2`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("FILLED");
    expect(body.fill).not.toBeNull();
    expect(body.fill.solver).toBe("0xcccccccccccccccccccccccccccccccccccccccc");
  });

  it("GET /intents/1 (open) returns intent with fill: null", async () => {
    const res = await fetch(`${baseUrl}/intents/1`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("OPEN");
    expect(body.fill).toBeNull();
  });

  it("GET /intents/999 returns 404", async () => {
    const res = await fetch(`${baseUrl}/intents/999`);
    expect(res.status).toBe(404);
  });

  it("POST /intents/metadata reserves metadata by intent hash", async () => {
    const intentHash = `0x${"12".repeat(32)}`;
    const res = await fetch(`${baseUrl}/intents/metadata`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        intent_hash: intentHash,
        owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        execution_target: "0x3333333333333333333333333333333333333333",
        execution_data: "0x1234",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.intent_hash).toBe(intentHash);
    expect(body.execution_target).toBe("0x3333333333333333333333333333333333333333");
  });

  it("PUT /intents/1/metadata attaches metadata to an indexed intent", async () => {
    const res = await fetch(`${baseUrl}/intents/1/metadata`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        execution_target: "0x3333333333333333333333333333333333333333",
        execution_data: "0x1234",
        required_attestation_subject: `0x${"34".repeat(32)}`,
      }),
    });
    expect(res.status).toBe(200);

    const intentRes = await fetch(`${baseUrl}/intents/1`);
    const body = await intentRes.json();
    expect(body.metadata.execution_data).toBe("0x1234");
    expect(body.metadata.required_attestation_subject).toBe(`0x${"34".repeat(32)}`);
  });
});

describe("Policies", () => {
  it("GET /accounts/0x.../policies returns policies", async () => {
    const res = await fetch(`${baseUrl}/accounts/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/policies`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.account).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(body.policies).toHaveLength(2);
    expect(body.pagination).toBeDefined();
  });

  it("GET /accounts/invalid/policies returns 400", async () => {
    const res = await fetch(`${baseUrl}/accounts/invalid/policies`);
    expect(res.status).toBe(400);
  });
});

describe("Preflight", () => {
  it("POST /preflight allows an allowlisted target", async () => {
    const res = await fetch(`${baseUrl}/preflight`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        account: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        target: "0x3333333333333333333333333333333333333333",
        value: "0",
        data: "0x",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allowed).toBe(true);
    expect(body.action).toContain("empty call");
  });

  it("POST /preflight denies a missing target allowlist", async () => {
    const res = await fetch(`${baseUrl}/preflight`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        account: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        target: "0x4444444444444444444444444444444444444444",
        value: "0",
        data: "0x",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allowed).toBe(false);
    expect(body.missing_policies).toContain("target_allowlist");
    expect(body.required_policy_updates[0].policy_type).toBe("target_allowlist");
  });
});

describe("Bids", () => {
  it("POST /intents/1/bids creates a solver bid", async () => {
    const res = await fetch(`${baseUrl}/intents/1/bids`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        solver: "0xcccccccccccccccccccccccccccccccccccccccc",
        amount_in: "1000",
        amount_out: "950",
        fee: "5",
        valid_until: "9999999999",
        execution_plan: { route: "demo" },
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.intent_id).toBe("1");
    expect(body.status).toBe("OPEN");
  });

  it("GET /intents/1/bids lists bids in best-first order", async () => {
    const res = await fetch(`${baseUrl}/intents/1/bids`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bids.length).toBeGreaterThanOrEqual(1);
    expect(body.bids[0].amount_out).toBe("950");
  });

  it("POST /bids/1/select selects a bid", async () => {
    const res = await fetch(`${baseUrl}/bids/1/select`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("SELECTED");
  });
});

describe("Attestation Schemas", () => {
  it("GET /attestations/schemas returns built-in schemas", async () => {
    const res = await fetch(`${baseUrl}/attestations/schemas`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schemas.length).toBeGreaterThanOrEqual(4);
  });
});

describe("Participants", () => {
  it("GET /solvers returns registered solvers", async () => {
    const res = await fetch(`${baseUrl}/solvers?active=true`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.solvers).toHaveLength(1);
    expect(body.solvers[0].operator).toBe("0xcccccccccccccccccccccccccccccccccccccccc");
    expect(body.solvers[0].successful_fills).toBe("2");
  });

  it("GET /solvers/1 returns solver data", async () => {
    const res = await fetch(`${baseUrl}/solvers/1`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.solver_id).toBe("1");
    expect(body.bond).toBe("1000");
  });

  it("GET /attestors returns registered attestors", async () => {
    const res = await fetch(`${baseUrl}/attestors?active=true`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.attestors).toHaveLength(1);
    expect(body.attestors[0].operator).toBe("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
    expect(body.attestors[0].attestations).toBe("5");
  });

  it("GET /attestors/1 returns attestor data", async () => {
    const res = await fetch(`${baseUrl}/attestors/1`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.attestor_id).toBe("1");
    expect(body.revoked_attestations).toBe("1");
  });
});

describe("Commerce", () => {
  it("GET /commerce/merchants/1/reputation returns receipts, disputes, and trust signals", async () => {
    const res = await fetch(`${baseUrl}/merchants/1/reputation`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.merchant.merchant_id).toBe("1");
    expect(body.commerce.receipts).toBe("1");
    expect(body.commerce.fulfilled_receipts).toBe("1");
    expect(body.disputes.resolved_disputes).toBe("1");
    expect(body.trust_signals_by_kind).toHaveLength(2);
  });

  it("GET /commerce/trust-signals returns filtered trust signals", async () => {
    const res = await fetch(`${baseUrl}/trust-signals?subject_type=0&subject_id=1&kind=0`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trust_signals).toHaveLength(1);
    expect(body.trust_signals[0].reporter).toBe("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
  });
});

describe("Catalogs", () => {
  it("POST /catalogs stores exact catalog JSON and GET /catalogs/:hash returns it", async () => {
    const catalog = JSON.stringify({
      merchant: { name: "Example", network: "base-sepolia" },
      services: [{ service_id: "weather.current", endpoint: "https://merchant.example/weather" }],
    }, null, 2);
    const expectedHash = keccak256(toBytes(catalog));

    const res = await fetch(`${baseUrl}/catalogs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        catalog_json: catalog,
        expected_hash: expectedHash,
        merchant_id: "1",
        service_id: "weather.current",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.catalog_hash).toBe(expectedHash);
    expect(body.uri).toBe(`${baseUrl}/catalogs/${expectedHash}`);

    const catalogRes = await fetch(body.uri);
    expect(catalogRes.status).toBe(200);
    expect(await catalogRes.text()).toBe(catalog);
  });

  it("POST /catalogs rejects mismatched expected_hash", async () => {
    const res = await fetch(`${baseUrl}/catalogs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        catalog_json: "{\"ok\":true}",
        expected_hash: `0x${"11".repeat(32)}`,
      }),
    });
    expect(res.status).toBe(409);
  });
});

describe("Analytics", () => {
  it("GET /analytics/commerce returns commerce volume and fee metrics", async () => {
    const res = await fetch(`${baseUrl}/analytics/commerce`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.merchants).toBe("1");
    expect(body.summary.receipts).toBe("1");
    expect(body.summary.settled_volume).toBe("1000000");
    expect(body.summary.settled_protocol_fees).toBe("0");
    expect(body.summary.resolved_disputes).toBe("1");
    expect(body.volume_by_token[0].token).toBe("0x1111111111111111111111111111111111111111");
    expect(body.volume_by_payment_rail[0].payment_rail).toBe(3);
    expect(body.top_merchants[0].merchant_id).toBe("1");
    expect(body.facilitator_volume[0].facilitator).toBe("0xcccccccccccccccccccccccccccccccccccccccc");
    expect(body.trust_signals_by_kind).toHaveLength(2);
  });
});

describe("Tx Explain", () => {
  it("GET /tx/0x.../explain returns summary with events", async () => {
    const res = await fetch(`${baseUrl}/tx/0x00000000000000000000000000000000000000000000000000000000abcdef01/explain`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tx_hash).toBe("0x00000000000000000000000000000000000000000000000000000000abcdef01");
    expect(body.summary).toContain("Agent #1 registered");
    expect(body.events).toHaveLength(2);
    expect(body.events[0].description).toContain("Agent #1 registered");
    expect(body.events[1].description).toContain("Intent #1 submitted");
  });

  it("GET /tx/0x000.../explain (missing) returns 404", async () => {
    const hash = "0x" + "0".repeat(64);
    const res = await fetch(`${baseUrl}/tx/${hash}/explain`);
    expect(res.status).toBe(404);
  });
});

describe("Not Found", () => {
  it("GET /nonexistent returns 404", async () => {
    const res = await fetch(`${baseUrl}/nonexistent`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not found");
  });
});
