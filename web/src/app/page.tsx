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
    icon: "ID",
    title: "Agent identity and budgets",
    description:
      "Agents can register identity, execute through policy-aware smart accounts, and operate within delegated budgets.",
  },
  {
    icon: "MR",
    title: "Merchant and service discovery",
    description:
      "Merchants publish onchain service records with metadata hashes, capability hashes, payout context, and active status.",
  },
  {
    icon: "QT",
    title: "Verifiable quote commitments",
    description:
      "Quotes bind service, agent, token, amount, expiry, nonce, payment rail, resource hash, terms hash, and fee terms.",
  },
  {
    icon: "PY",
    title: "Multiple payment rails",
    description:
      "Cortex supports wallet transfers, ERC-20 transfers, swaps, facilitator-mediated payments, and x402 acceptance.",
  },
  {
    icon: "RC",
    title: "Receipts and disputes",
    description:
      "Settled commerce creates receipt records and dispute signals that can feed reputation for agents and merchants.",
  },
  {
    icon: "AN",
    title: "Analytics and APIs",
    description:
      "Indexer, REST API, MCP tools, and dashboard expose protocol state for agents, developers, and operators.",
  },
];

export default function Home() {
  return (
    <>
      <Hero />

      <section className="py-20 border-t border-border">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            Built for agentic commerce
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
            Run the full stack locally, register merchants and services, configure agent policy,
            commit quotes, record receipts, and inspect protocol analytics.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="/docs/local-dev"
              className="inline-block rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#06110d] transition-colors hover:bg-emerald-300"
            >
              Local dev guide
            </a>
            <a
              href="/docs/architecture"
              className="inline-block rounded-lg border border-border px-5 py-3 text-sm font-semibold text-muted transition-colors hover:border-cyan-300/70 hover:text-text"
            >
              Architecture docs
            </a>
            <a
              href="/blog/cortex-explained"
              className="inline-block rounded-lg border border-border px-5 py-3 text-sm font-semibold text-muted transition-colors hover:border-cyan-300/70 hover:text-text"
            >
              Plain English
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
