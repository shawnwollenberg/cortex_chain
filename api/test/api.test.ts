import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { createApp } from "../src/app.js";
import type { Server } from "node:http";

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
}

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });

  // Drop and recreate tables
  await pool.query("DROP TABLE IF EXISTS fills, policies, tx_receipts, intents, agents, indexer_state CASCADE");

  // Run migrations (read the SQL file)
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const migrationPath = resolve(__dirname, "..", "..", "indexer", "migrations", "001_init.sql");
  const sql = readFileSync(migrationPath, "utf-8");
  await pool.query(sql);

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
