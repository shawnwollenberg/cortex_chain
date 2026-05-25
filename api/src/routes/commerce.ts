import { Router } from "express";
import type pg from "pg";
import { parsePagination, isValidAddress, isValidId } from "../utils.js";

function isBytes32(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

function isEnumNumber(value: string, max: number): boolean {
  return /^\d+$/.test(value) && Number(value) <= max;
}

export function createCommerceRouter(pool: pg.Pool): Router {
  const router = Router();

  router.get("/merchants", async (req, res, next) => {
    try {
      const owner = req.query.owner as string | undefined;
      const active = req.query.active as string | undefined;
      const { limit, offset } = parsePagination(req.query);
      if (owner && !isValidAddress(owner)) {
        res.status(400).json({ error: "Invalid owner address" });
        return;
      }

      const conditions: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (owner) {
        conditions.push(`owner = $${i++}`);
        params.push(owner.toLowerCase());
      }
      if (active !== undefined) {
        if (!["true", "false"].includes(active)) {
          res.status(400).json({ error: "active must be true or false" });
          return;
        }
        conditions.push(`active = $${i++}`);
        params.push(active === "true");
      }
      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      params.push(limit, offset);
      const result = await pool.query(
        `SELECT * FROM merchants ${where} ORDER BY merchant_id LIMIT $${i++} OFFSET $${i}`,
        params,
      );
      res.json({ merchants: result.rows, pagination: { limit, offset, count: result.rows.length } });
    } catch (err) {
      next(err);
    }
  });

  router.get("/merchants/:id", async (req, res, next) => {
    try {
      if (!isValidId(req.params.id)) {
        res.status(400).json({ error: "Invalid merchant ID" });
        return;
      }
      const result = await pool.query("SELECT * FROM merchants WHERE merchant_id = $1", [req.params.id]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Merchant not found" });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  router.get("/merchants/:id/reputation", async (req, res, next) => {
    try {
      if (!isValidId(req.params.id)) {
        res.status(400).json({ error: "Invalid merchant ID" });
        return;
      }

      const merchant = await pool.query("SELECT * FROM merchants WHERE merchant_id = $1", [req.params.id]);
      if (merchant.rows.length === 0) {
        res.status(404).json({ error: "Merchant not found" });
        return;
      }

      const [commerce, disputes, signals] = await Promise.all([
        pool.query(
          `SELECT
            COUNT(*) AS receipts,
            COALESCE(SUM(amount), 0) AS settled_volume,
            COUNT(*) FILTER (WHERE fulfillment_hash <> '') AS fulfilled_receipts
           FROM commerce_receipts
           WHERE merchant_id = $1`,
          [req.params.id],
        ),
        pool.query(
          `SELECT
            COUNT(*) AS disputes,
            COUNT(*) FILTER (WHERE d.status = 'OPEN') AS open_disputes,
            COUNT(*) FILTER (WHERE d.status = 'RESOLVED') AS resolved_disputes,
            COUNT(*) FILTER (WHERE d.status = 'REJECTED') AS rejected_disputes
           FROM disputes d
           INNER JOIN commerce_receipts r ON r.receipt_id = d.receipt_id
           WHERE r.merchant_id = $1`,
          [req.params.id],
        ),
        pool.query(
          `SELECT kind, COUNT(*) AS signals
           FROM trust_signals
           WHERE subject_type = 0 AND subject_id = $1
           GROUP BY kind
           ORDER BY kind`,
          [req.params.id],
        ),
      ]);

      res.json({
        merchant: merchant.rows[0],
        commerce: commerce.rows[0],
        disputes: disputes.rows[0],
        trust_signals_by_kind: signals.rows,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/services", async (req, res, next) => {
    try {
      const merchantId = req.query.merchant_id as string | undefined;
      const capabilityHash = req.query.capability_hash as string | undefined;
      const active = req.query.active as string | undefined;
      const { limit, offset } = parsePagination(req.query);

      if (merchantId && !isValidId(merchantId)) {
        res.status(400).json({ error: "Invalid merchant_id" });
        return;
      }
      if (capabilityHash && !isBytes32(capabilityHash)) {
        res.status(400).json({ error: "Invalid capability_hash" });
        return;
      }

      const conditions: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (merchantId) {
        conditions.push(`merchant_id = $${i++}`);
        params.push(merchantId);
      }
      if (capabilityHash) {
        conditions.push(`capability_hash = $${i++}`);
        params.push(capabilityHash.toLowerCase());
      }
      if (active !== undefined) {
        if (!["true", "false"].includes(active)) {
          res.status(400).json({ error: "active must be true or false" });
          return;
        }
        conditions.push(`active = $${i++}`);
        params.push(active === "true");
      }
      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      params.push(limit, offset);
      const result = await pool.query(
        `SELECT * FROM services ${where} ORDER BY service_numeric_id LIMIT $${i++} OFFSET $${i}`,
        params,
      );
      res.json({ services: result.rows, pagination: { limit, offset, count: result.rows.length } });
    } catch (err) {
      next(err);
    }
  });

  router.get("/services/:id", async (req, res, next) => {
    try {
      if (!isValidId(req.params.id)) {
        res.status(400).json({ error: "Invalid service ID" });
        return;
      }
      const result = await pool.query("SELECT * FROM services WHERE service_numeric_id = $1", [req.params.id]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Service not found" });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  router.get("/facilitators", async (req, res, next) => {
    try {
      const active = req.query.active as string | undefined;
      const { limit, offset } = parsePagination(req.query);
      const params: unknown[] = [];
      let where = "";
      if (active !== undefined) {
        if (!["true", "false"].includes(active)) {
          res.status(400).json({ error: "active must be true or false" });
          return;
        }
        where = "WHERE active = $1";
        params.push(active === "true");
      }
      params.push(limit, offset);
      const base = params.length === 2 ? 1 : 2;
      const result = await pool.query(
        `SELECT * FROM facilitators ${where} ORDER BY facilitator_id LIMIT $${base} OFFSET $${base + 1}`,
        params,
      );
      res.json({ facilitators: result.rows, pagination: { limit, offset, count: result.rows.length } });
    } catch (err) {
      next(err);
    }
  });

  router.get("/quotes/:hash", async (req, res, next) => {
    try {
      const hash = req.params.hash.toLowerCase();
      if (!isBytes32(hash)) {
        res.status(400).json({ error: "Invalid quote hash" });
        return;
      }
      const result = await pool.query("SELECT * FROM quotes WHERE quote_hash = $1", [hash]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Quote not found" });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  router.get("/receipts", async (req, res, next) => {
    try {
      const agent = req.query.agent as string | undefined;
      const merchantId = req.query.merchant_id as string | undefined;
      const { limit, offset } = parsePagination(req.query);
      const conditions: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (agent) {
        if (!isValidAddress(agent)) {
          res.status(400).json({ error: "Invalid agent address" });
          return;
        }
        conditions.push(`agent = $${i++}`);
        params.push(agent.toLowerCase());
      }
      if (merchantId) {
        if (!isValidId(merchantId)) {
          res.status(400).json({ error: "Invalid merchant_id" });
          return;
        }
        conditions.push(`merchant_id = $${i++}`);
        params.push(merchantId);
      }
      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      params.push(limit, offset);
      const result = await pool.query(
        `SELECT * FROM commerce_receipts ${where} ORDER BY receipt_id DESC LIMIT $${i++} OFFSET $${i}`,
        params,
      );
      res.json({ receipts: result.rows, pagination: { limit, offset, count: result.rows.length } });
    } catch (err) {
      next(err);
    }
  });

  router.get("/disputes", async (req, res, next) => {
    try {
      const receiptId = req.query.receipt_id as string | undefined;
      const { limit, offset } = parsePagination(req.query);
      const params: unknown[] = [];
      let where = "";
      if (receiptId) {
        if (!isValidId(receiptId)) {
          res.status(400).json({ error: "Invalid receipt_id" });
          return;
        }
        where = "WHERE receipt_id = $1";
        params.push(receiptId);
      }
      params.push(limit, offset);
      const base = params.length === 2 ? 1 : 2;
      const result = await pool.query(
        `SELECT * FROM disputes ${where} ORDER BY dispute_id DESC LIMIT $${base} OFFSET $${base + 1}`,
        params,
      );
      res.json({ disputes: result.rows, pagination: { limit, offset, count: result.rows.length } });
    } catch (err) {
      next(err);
    }
  });

  router.get("/trust-signals", async (req, res, next) => {
    try {
      const subjectType = req.query.subject_type as string | undefined;
      const subjectId = req.query.subject_id as string | undefined;
      const kind = req.query.kind as string | undefined;
      const reporter = req.query.reporter as string | undefined;
      const { limit, offset } = parsePagination(req.query);

      if (subjectType !== undefined && !isEnumNumber(subjectType, 3)) {
        res.status(400).json({ error: "Invalid subject_type" });
        return;
      }
      if (subjectId !== undefined && !isValidId(subjectId)) {
        res.status(400).json({ error: "Invalid subject_id" });
        return;
      }
      if (kind !== undefined && !isEnumNumber(kind, 3)) {
        res.status(400).json({ error: "Invalid kind" });
        return;
      }
      if (reporter !== undefined && !isValidAddress(reporter)) {
        res.status(400).json({ error: "Invalid reporter address" });
        return;
      }

      const conditions: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (subjectType !== undefined) {
        conditions.push(`subject_type = $${i++}`);
        params.push(Number(subjectType));
      }
      if (subjectId !== undefined) {
        conditions.push(`subject_id = $${i++}`);
        params.push(subjectId);
      }
      if (kind !== undefined) {
        conditions.push(`kind = $${i++}`);
        params.push(Number(kind));
      }
      if (reporter !== undefined) {
        conditions.push(`reporter = $${i++}`);
        params.push(reporter.toLowerCase());
      }
      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      params.push(limit, offset);

      const result = await pool.query(
        `SELECT * FROM trust_signals ${where} ORDER BY signal_id DESC LIMIT $${i++} OFFSET $${i}`,
        params,
      );
      res.json({ trust_signals: result.rows, pagination: { limit, offset, count: result.rows.length } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
