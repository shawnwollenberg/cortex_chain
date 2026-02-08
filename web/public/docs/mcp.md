# MCP Server

Cortex includes a Model Context Protocol (MCP) server that exposes chain state as tools for AI agents. The server connects to the same Postgres database as the REST API.

## Server Info

```json
{
  "name": "ai-chain",
  "version": "0.1.0"
}
```

## Tools

### lookup_agent

Look up an agent by its numeric ID. Returns owner, metadata, pubkey, capabilities, and revocation status.

**Parameters:** `agentId` (number, required)

**Example:**
```json
// Request
{ "agentId": 1 }

// Response
{
  "agent_id": "1",
  "owner": "0x3c44...",
  "metadata_uri": "ipfs://agent-meta",
  "pubkey": "0xaabb",
  "revoked": false
}
```

### list_open_intents

List intents filtered by status. Defaults to OPEN intents. Returns intent details including tokens, amounts, and deadlines.

**Parameters:** `status` (string, optional: "open" | "filled" | "cancelled"), `limit` (number, optional)

**Example:**
```json
// Request
{ "status": "open", "limit": 10 }

// Response: array of intent objects with owner, tokens, amounts, deadline, nonce
```

### get_policy

Get spending policies for a smart account. Returns spend limits, target allowlists, and function allowlists.

**Parameters:** `account` (string, required — Ethereum address)

**Example:**
```json
// Request
{ "account": "0x70997..." }

// Response: spend limits, target allowlists, and function selector allowlists
```

### explain_tx

Get a human-readable explanation of a transaction. Returns decoded events and a summary of what happened.

**Parameters:** `txHash` (string, required)

**Example:**
```json
// Request
{ "txHash": "0xabc..." }

// Response
{
  "summary": "Transaction contained 1 event(s)",
  "events": [
    {
      "eventName": "IntentSubmitted",
      "description": "Intent #1 submitted by 0x..."
    }
  ]
}
```

### lookup_attestation

Look up an attestation by its numeric ID. Returns attester, schema, subject, data hash, and revocation status.

**Parameters:** `attestationId` (number, required)

**Example:**
```json
// Request
{ "attestationId": 1 }

// Response: attester, schema, subject, data hash, and revocation status
```

## Usage

The MCP server runs as a stdio transport. Connect it to any MCP-compatible client (Claude Desktop, Claude Code, etc.) by adding it to your MCP configuration:

```json
{
  "mcpServers": {
    "cortex": {
      "command": "node",
      "args": ["mcp/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgres://user:pass@localhost:5433/cortex"
      }
    }
  }
}
```
