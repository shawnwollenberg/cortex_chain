import express from "express";
import type pg from "pg";
import { requestLogger, notFoundHandler, errorHandler } from "./middleware.js";
import { createAgentsRouter } from "./routes/agents.js";
import { createIntentsRouter } from "./routes/intents.js";
import { createPoliciesRouter } from "./routes/policies.js";
import { createTxRouter } from "./routes/tx.js";
import { createAttestationsRouter } from "./routes/attestations.js";
import { createParticipantsRouter } from "./routes/participants.js";
import { createPreflightRouter } from "./routes/preflight.js";
import { createBidsRouter } from "./routes/bids.js";
import { createCommerceRouter } from "./routes/commerce.js";
import { createAnalyticsRouter } from "./routes/analytics.js";
import { createCatalogsRouter } from "./routes/catalogs.js";

export function createApp(pool: pg.Pool): express.Express {
  const app = express();

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: "256kb" }));
  app.use(requestLogger);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/agents", createAgentsRouter(pool));
  app.use("/intents", createIntentsRouter(pool));
  app.use("/accounts", createPoliciesRouter(pool));
  app.use("/tx", createTxRouter(pool));
  app.use("/attestations", createAttestationsRouter(pool));
  app.use("/preflight", createPreflightRouter(pool));
  app.use("/analytics", createAnalyticsRouter(pool));
  app.use("/catalogs", createCatalogsRouter(pool));
  app.use("/", createBidsRouter(pool));
  app.use("/", createParticipantsRouter(pool));
  app.use("/", createCommerceRouter(pool));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
