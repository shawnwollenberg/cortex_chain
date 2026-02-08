import express from "express";
import type pg from "pg";
import { requestLogger, notFoundHandler, errorHandler } from "./middleware.js";
import { createAgentsRouter } from "./routes/agents.js";
import { createIntentsRouter } from "./routes/intents.js";
import { createPoliciesRouter } from "./routes/policies.js";
import { createTxRouter } from "./routes/tx.js";
import { createAttestationsRouter } from "./routes/attestations.js";

export function createApp(pool: pg.Pool): express.Express {
  const app = express();

  app.use(express.json());
  app.use(requestLogger);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/agents", createAgentsRouter(pool));
  app.use("/intents", createIntentsRouter(pool));
  app.use("/accounts", createPoliciesRouter(pool));
  app.use("/tx", createTxRouter(pool));
  app.use("/attestations", createAttestationsRouter(pool));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
