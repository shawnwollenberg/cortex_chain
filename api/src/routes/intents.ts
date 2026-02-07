import { Router } from "express";
import type pg from "pg";
import { parsePagination, isValidId } from "../utils.js";

const VALID_STATUSES = ["OPEN", "FILLED", "CANCELLED"];

export function createIntentsRouter(pool: pg.Pool): Router {
  const router = Router();

  // GET /intents/:id
  router.get("/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isValidId(id)) {
        res.status(400).json({ error: "Invalid intent ID" });
        return;
      }

      const intentResult = await pool.query("SELECT * FROM intents WHERE intent_id = $1", [id]);
      if (intentResult.rows.length === 0) {
        res.status(404).json({ error: "Intent not found" });
        return;
      }

      const intent = intentResult.rows[0];
      let fill = null;

      if (intent.status === "FILLED") {
        const fillResult = await pool.query(
          "SELECT * FROM fills WHERE intent_id = $1",
          [id],
        );
        if (fillResult.rows.length > 0) {
          fill = fillResult.rows[0];
        }
      }

      res.json({ ...intent, fill });
    } catch (err) {
      next(err);
    }
  });

  // GET /intents?status=open|filled|cancelled
  router.get("/", async (req, res, next) => {
    try {
      const status = req.query.status as string | undefined;
      const { limit, offset } = parsePagination(req.query);

      if (status) {
        const normalized = status.toUpperCase();
        if (!VALID_STATUSES.includes(normalized)) {
          res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
          return;
        }

        const result = await pool.query(
          "SELECT * FROM intents WHERE status = $1 ORDER BY intent_id DESC LIMIT $2 OFFSET $3",
          [normalized, limit, offset],
        );

        res.json({
          intents: result.rows,
          pagination: { limit, offset, count: result.rows.length },
        });
        return;
      }

      const result = await pool.query(
        "SELECT * FROM intents ORDER BY intent_id DESC LIMIT $1 OFFSET $2",
        [limit, offset],
      );

      res.json({
        intents: result.rows,
        pagination: { limit, offset, count: result.rows.length },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
