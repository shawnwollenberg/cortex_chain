import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { lookupAgentSchema, lookupAgent } from "./tools/lookup-agent.js";
import { listOpenIntentsSchema, listOpenIntents } from "./tools/list-open-intents.js";
import { getPolicySchema, getPolicy } from "./tools/get-policy.js";
import { explainTxSchema, explainTx } from "./tools/explain-tx.js";
import { lookupAttestationSchema, lookupAttestation } from "./tools/lookup-attestation.js";
import { listSolversSchema, listSolvers } from "./tools/list-solvers.js";
import { listAttestorsSchema, listAttestors } from "./tools/list-attestors.js";
import { preflightTransactionSchema, preflightTransaction } from "./tools/preflight-transaction.js";
import { listBidsSchema, listBids } from "./tools/list-bids.js";
import { listAttestationSchemasSchema, listAttestationSchemas } from "./tools/list-attestation-schemas.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "ai-chain",
    version: "0.1.0",
  });

  server.tool(
    "lookup_agent",
    "Look up an agent by its numeric ID. Returns owner, metadata, pubkey, capabilities, and revocation status.",
    lookupAgentSchema,
    async (args) => ({
      content: [{ type: "text", text: await lookupAgent(args) }],
    }),
  );

  server.tool(
    "list_open_intents",
    "List intents filtered by status. Defaults to OPEN intents. Returns intent details including tokens, amounts, and deadlines.",
    listOpenIntentsSchema,
    async (args) => ({
      content: [{ type: "text", text: await listOpenIntents(args) }],
    }),
  );

  server.tool(
    "get_policy",
    "Get spending policies for a smart account. Returns spend limits, target allowlists, and function allowlists.",
    getPolicySchema,
    async (args) => ({
      content: [{ type: "text", text: await getPolicy(args) }],
    }),
  );

  server.tool(
    "explain_tx",
    "Get a human-readable explanation of a transaction. Returns decoded events and a summary of what happened.",
    explainTxSchema,
    async (args) => ({
      content: [{ type: "text", text: await explainTx(args) }],
    }),
  );

  server.tool(
    "lookup_attestation",
    "Look up an attestation by its numeric ID. Returns attester, schema, subject, data hash, and revocation status.",
    lookupAttestationSchema,
    async (args) => ({
      content: [{ type: "text", text: await lookupAttestation(args) }],
    }),
  );

  server.tool(
    "list_solvers",
    "List registered solvers, optionally filtered by active status. Returns metadata, bond, and fill counters.",
    listSolversSchema,
    async (args) => ({
      content: [{ type: "text", text: await listSolvers(args) }],
    }),
  );

  server.tool(
    "list_attestors",
    "List registered attestors, optionally filtered by active status. Returns metadata, schema hash, and attestation counters.",
    listAttestorsSchema,
    async (args) => ({
      content: [{ type: "text", text: await listAttestors(args) }],
    }),
  );

  server.tool(
    "preflight_transaction",
    "Check whether an account can execute a transaction based on indexed policies. Returns allow/deny reasons and spend checks.",
    preflightTransactionSchema,
    async (args) => ({
      content: [{ type: "text", text: await preflightTransaction(args) }],
    }),
  );

  server.tool(
    "list_bids",
    "List solver bids for an intent, optionally filtered by bid status.",
    listBidsSchema,
    async (args) => ({
      content: [{ type: "text", text: await listBids(args) }],
    }),
  );

  server.tool(
    "list_attestation_schemas",
    "List built-in and registered attestation schema definitions.",
    listAttestationSchemasSchema,
    async () => ({
      content: [{ type: "text", text: await listAttestationSchemas() }],
    }),
  );

  return server;
}
