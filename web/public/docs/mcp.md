# MCP Server

Cortex includes a Model Context Protocol server that exposes chain and indexer state as tools for AI agents.

## Tools

| Tool | Purpose |
|------|---------|
| `lookup_agent` | Look up an agent by ID. |
| `list_open_intents` | List intents filtered by status. |
| `get_policy` | Get policies for a smart account. |
| `explain_tx` | Explain indexed transaction events. |
| `lookup_attestation` | Look up an attestation by ID. |
| `list_solvers` | List registered solvers and fill counters. |
| `list_attestors` | List registered attestors and attestation counters. |
| `preflight_transaction` | Check indexed policies before signing/submitting a transaction. |

## Local Usage

Build the server:

```bash
cd mcp
npm run build
```

Run with:

```bash
DATABASE_URL=postgresql://ai_chain:ai_chain@localhost:5433/ai_chain node dist/src/index.js
```

When configuring an MCP client from the repo root, use:

```json
{
  "mcpServers": {
    "cortex": {
      "command": "node",
      "args": ["mcp/dist/src/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://ai_chain:ai_chain@localhost:5433/ai_chain",
        "API_URL": "http://localhost:3001"
      }
    }
  }
}
```
