import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Docs — Cortex",
  description: "Developer documentation for the Cortex agent-native Ethereum L2.",
  alternates: {
    types: { "text/markdown": "/docs/getting-started.md" },
  },
};

const SECTIONS = [
  {
    title: "Local Development",
    href: "/docs/local-dev",
    description: "Run the full stack locally in under 5 minutes.",
  },
  {
    title: "Architecture",
    href: "/docs/architecture",
    description: "System diagram, data flow, and database schema.",
  },
  {
    title: "Contracts",
    href: "/docs/contracts",
    description: "AgentRegistry, IntentBook, PolicyModule, and PolicyAccount reference.",
  },
  {
    title: "REST API",
    href: "/docs/api",
    description: "Endpoints for agents, intents, policies, and transaction explanations.",
  },
  {
    title: "MCP Server",
    href: "/docs/mcp",
    description: "Model Context Protocol tools for AI agent integration.",
  },
  {
    title: "Design Decisions",
    href: "/docs/decisions",
    description: "Key architectural choices and their tradeoffs.",
  },
  {
    title: "Security",
    href: "/docs/security",
    description: "Threat model, mitigations, and invariants.",
  },
];

export default function DocsHome() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Documentation</h1>
      <p className="text-muted mb-10 max-w-2xl">
        Cortex is an EVM-compatible Layer 2 designed for AI agents. These docs cover
        the full stack: smart contracts, offchain services, APIs, and local development.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-lg border border-border bg-surface p-5 hover:border-muted transition-colors"
          >
            <h3 className="font-semibold mb-1">{s.title}</h3>
            <p className="text-sm text-muted">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
