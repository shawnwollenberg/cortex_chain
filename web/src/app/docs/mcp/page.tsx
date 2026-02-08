import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "MCP Server — Cortex Docs",
  description: "Model Context Protocol server tools for AI agent integration with Cortex.",
  alternates: { types: { "text/markdown": "/docs/mcp.md" } },
};

export default function McpPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">MCP Server</h1>
      <p className="text-muted mb-10">
        Cortex includes a <strong>Model Context Protocol</strong> (MCP) server that exposes
        chain state as tools for AI agents. The server connects to the same Postgres database
        as the REST API.
      </p>

      <h2 className="text-xl font-semibold mb-4">Server Info</h2>
      <CodeBlock language="json">{`{
  "name": "ai-chain",
  "version": "0.1.0"
}`}</CodeBlock>

      <h2 className="text-xl font-semibold mb-4 mt-10">Tools</h2>

      <div className="space-y-8">
        <ToolDoc
          name="lookup_agent"
          description="Look up an agent by its numeric ID. Returns owner, metadata, pubkey, capabilities, and revocation status."
          params="agentId: number"
          example={`// Agent calls:
lookup_agent({ agentId: 1 })

// Returns:
{
  "agent_id": "1",
  "owner": "0x3c44...",
  "metadata_uri": "ipfs://agent-meta",
  "pubkey": "0xaabb",
  "revoked": false
}`}
        />

        <ToolDoc
          name="list_open_intents"
          description="List intents filtered by status. Defaults to OPEN intents. Returns intent details including tokens, amounts, and deadlines."
          params="status?: 'open' | 'filled' | 'cancelled', limit?: number"
          example={`// List open intents:
list_open_intents({ status: "open", limit: 10 })

// Returns array of intent objects with
// owner, tokens, amounts, deadline, nonce`}
        />

        <ToolDoc
          name="get_policy"
          description="Get spending policies for a smart account. Returns spend limits, target allowlists, and function allowlists."
          params="account: string (address)"
          example={`// Query account policies:
get_policy({ account: "0x70997..." })

// Returns spend limits, target allowlists,
// and function selector allowlists`}
        />

        <ToolDoc
          name="explain_tx"
          description="Get a human-readable explanation of a transaction. Returns decoded events and a summary of what happened."
          params="txHash: string"
          example={`// Explain a transaction:
explain_tx({ txHash: "0xabc..." })

// Returns summary + decoded events:
// "Intent #1 submitted by 0x..."`}
        />

        <ToolDoc
          name="lookup_attestation"
          description="Look up an attestation by its numeric ID. Returns attester, schema, subject, data hash, and revocation status."
          params="attestationId: number"
          example={`// Look up attestation:
lookup_attestation({ attestationId: 1 })

// Returns attester, schema, subject,
// data hash, and revocation status`}
        />
      </div>

      <h2 className="text-xl font-semibold mb-4 mt-10">Usage</h2>
      <p className="text-sm text-muted mb-4">
        The MCP server runs as a stdio transport. Connect it to any MCP-compatible client
        (Claude Desktop, Claude Code, etc.) by adding it to your MCP configuration:
      </p>
      <CodeBlock language="json">{`{
  "mcpServers": {
    "cortex": {
      "command": "node",
      "args": ["mcp/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgres://user:pass@localhost:5433/cortex"
      }
    }
  }
}`}</CodeBlock>
    </div>
  );
}

function ToolDoc({
  name,
  description,
  params,
  example,
}: {
  name: string;
  description: string;
  params: string;
  example: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h3 className="font-mono text-sm font-semibold mb-1">{name}</h3>
      <p className="text-sm text-muted mb-3">{description}</p>
      <p className="text-xs text-muted mb-3">
        <strong>Parameters:</strong> <code>{params}</code>
      </p>
      <pre className="!bg-bg border border-border rounded-lg p-4 overflow-x-auto text-xs leading-relaxed">
        <code>{example}</code>
      </pre>
    </div>
  );
}
