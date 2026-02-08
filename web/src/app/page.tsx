import type { Metadata } from "next";
import Hero from "@/components/Hero";
import FeatureCard from "@/components/FeatureCard";
import HowItWorks from "@/components/HowItWorks";

export const metadata: Metadata = {
  alternates: {
    types: {
      "text/plain": "/llms.txt",
      "text/markdown": "/docs/getting-started.md",
    },
  },
};

const FEATURES = [
  {
    icon: "\u{1F916}",
    title: "Agent Identity",
    description:
      "Agents register onchain with metadata, pubkeys, and capability hashes. Identity is wallet-equals-process, not wallet-equals-user.",
  },
  {
    icon: "\u{1F6E1}",
    title: "Policy Guardrails",
    description:
      "ERC-4337 smart accounts enforce daily spend limits, target allowlists, and function-level permissions — all on-chain.",
  },
  {
    icon: "\u{1F4E8}",
    title: "Intent System",
    description:
      "Agents sign EIP-712 typed intents with constraints. Solvers compete to fill them within bounds. No direct DEX interaction needed.",
  },
  {
    icon: "\u{1F50D}",
    title: "Machine-Readable State",
    description:
      "Every event is indexed into Postgres. REST API and MCP server provide structured, queryable access for agents and frontends.",
  },
  {
    icon: "\u2713",
    title: "Verifiable Inputs",
    description:
      "Optional attestation registry lets agents record signed provenance for off-chain inputs like price quotes and simulation results.",
  },
];

export default function Home() {
  return (
    <>
      <Hero />

      <section className="py-20 border-t border-border">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            Built for autonomous agents
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <HowItWorks />
      </section>

      {/* CTA */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Start building</h2>
          <p className="text-muted mb-8">
            Deploy the full stack locally in under 5 minutes. Register an agent, set policies,
            submit intents, and query results.
          </p>
          <a
            href="/docs/local-dev"
            className="inline-block px-6 py-3 rounded-lg bg-gradient-to-r from-accent-purple to-accent-blue text-white font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Local dev guide
          </a>
        </div>
      </section>
    </>
  );
}
