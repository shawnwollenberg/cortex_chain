import { Router } from "express";
import type pg from "pg";

export function createAnalyticsRouter(pool: pg.Pool): Router {
  const router = Router();

  router.get("/commerce", async (_req, res, next) => {
    try {
      const [
        counts,
        quoteStats,
        receiptStats,
        disputeStats,
        volumeByToken,
        topMerchants,
        topServices,
        facilitatorVolume,
        volumeByPaymentRail,
        trustSignalsByKind,
      ] = await Promise.all([
        pool.query(`
          SELECT
            (SELECT COUNT(*) FROM merchants) AS merchants,
            (SELECT COUNT(*) FROM merchants WHERE active = true) AS active_merchants,
            (SELECT COUNT(*) FROM services) AS services,
            (SELECT COUNT(*) FROM services WHERE active = true) AS active_services,
            (SELECT COUNT(*) FROM facilitators) AS facilitators,
            (SELECT COUNT(*) FROM facilitators WHERE active = true) AS active_facilitators
        `),
        pool.query(`
          SELECT
            COUNT(*) AS quotes,
            COUNT(*) FILTER (WHERE settled = true) AS settled_quotes,
            COALESCE(SUM(amount), 0) AS quoted_volume,
            COALESCE(SUM(protocol_fee_amount), 0) AS quoted_protocol_fees
          FROM quotes
        `),
        pool.query(`
          SELECT
            COUNT(*) AS receipts,
            COALESCE(SUM(amount), 0) AS settled_volume,
            COALESCE(SUM(protocol_fee_amount), 0) AS settled_protocol_fees
          FROM commerce_receipts
        `),
        pool.query(`
          SELECT
            COUNT(*) AS disputes,
            COUNT(*) FILTER (WHERE status = 'OPEN') AS open_disputes,
            COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved_disputes,
            COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected_disputes
          FROM disputes
        `),
        pool.query(`
          SELECT
            token,
            COUNT(*) AS receipts,
            COALESCE(SUM(amount), 0) AS settled_volume,
            COALESCE(SUM(protocol_fee_amount), 0) AS protocol_fees
          FROM commerce_receipts
          GROUP BY token
          ORDER BY SUM(amount) DESC
          LIMIT 20
        `),
        pool.query(`
          SELECT
            r.merchant_id,
            m.owner,
            COUNT(*) AS receipts,
            COALESCE(SUM(r.amount), 0) AS settled_volume,
            COALESCE(SUM(r.protocol_fee_amount), 0) AS protocol_fees
          FROM commerce_receipts r
          LEFT JOIN merchants m ON m.merchant_id = r.merchant_id
          GROUP BY r.merchant_id, m.owner
          ORDER BY SUM(r.amount) DESC
          LIMIT 20
        `),
        pool.query(`
          SELECT
            r.service_numeric_id,
            s.service_id,
            r.merchant_id,
            COUNT(*) AS receipts,
            COALESCE(SUM(r.amount), 0) AS settled_volume,
            COALESCE(SUM(r.protocol_fee_amount), 0) AS protocol_fees
          FROM commerce_receipts r
          LEFT JOIN services s ON s.service_numeric_id = r.service_numeric_id
          GROUP BY r.service_numeric_id, s.service_id, r.merchant_id
          ORDER BY SUM(r.amount) DESC
          LIMIT 20
        `),
        pool.query(`
          SELECT
            facilitator,
            COUNT(*) AS receipts,
            COALESCE(SUM(amount), 0) AS settled_volume,
            COALESCE(SUM(protocol_fee_amount), 0) AS protocol_fees
          FROM commerce_receipts
          GROUP BY facilitator
          ORDER BY SUM(amount) DESC
          LIMIT 20
        `),
        pool.query(`
          SELECT
            payment_rail,
            COUNT(*) AS receipts,
            COALESCE(SUM(amount), 0) AS settled_volume,
            COALESCE(SUM(protocol_fee_amount), 0) AS protocol_fees
          FROM commerce_receipts
          GROUP BY payment_rail
          ORDER BY SUM(amount) DESC
        `),
        pool.query(`
          SELECT
            kind,
            COUNT(*) AS signals
          FROM trust_signals
          GROUP BY kind
          ORDER BY kind
        `),
      ]);

      res.json({
        summary: {
          ...counts.rows[0],
          ...quoteStats.rows[0],
          ...receiptStats.rows[0],
          ...disputeStats.rows[0],
        },
        volume_by_token: volumeByToken.rows,
        top_merchants: topMerchants.rows,
        top_services: topServices.rows,
        facilitator_volume: facilitatorVolume.rows,
        volume_by_payment_rail: volumeByPaymentRail.rows,
        trust_signals_by_kind: trustSignalsByKind.rows,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
