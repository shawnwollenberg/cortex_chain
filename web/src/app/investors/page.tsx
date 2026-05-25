import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Investor Pitch — Cortex",
  description:
    "Investor overview for Cortex, a Base-native protocol for agentic commerce.",
};

const MARKET_SHIFTS = [
  "AI agents are moving from chat and workflow automation into purchasing, subscriptions, API calls, compute, data, and financial actions.",
  "Merchants need a way to accept autonomous buyers without treating every agent like an anonymous bot or unmanaged wallet.",
  "Payment rails like wallets, stablecoins, swaps, and x402 are improving, but commerce still needs discovery, policy, receipts, dispute signals, and reputation.",
];

const PRODUCT = [
  ["Merchant registry", "Onchain merchant, payout, service, facilitator, metadata, and capability records."],
  ["Quote commitments", "Canonical payment terms that bind merchant, service, agent, token, rail, amount, nonce, resource, terms, and fee fields."],
  ["Policy layer", "Delegated budgets for transfers, swaps, facilitator-mediated payments, and x402 authorizations."],
  ["Receipts and disputes", "Settlement records, result hashes, refund/dispute signals, and reputation inputs."],
  ["Analytics surface", "Indexed protocol metrics for merchants, agents, facilitators, services, volume, fees, and disputes."],
  ["Agent interfaces", "REST API, MCP tools, dashboard, SDK, and testnet runbooks."],
];

const BUSINESS = [
  ["Hosted protocol API", "Managed indexing, APIs, dashboards, alerts, and developer tooling for teams building agent commerce."],
  ["Merchant verification", "Verified merchant/service profiles, richer discovery placement, and trust/reporting tools."],
  ["Facilitator routing", "Commercial relationships around payment facilitation, settlement reliability, and payment acceptance."],
  ["Protocol fees later", "Fee fields are instrumented today at 0 bps, giving a clean future path once usage and trust exist."],
];

const ROADMAP = [
  ["Now", "Local stack, commerce contracts, indexed analytics, dashboard, docs, and Base Sepolia deployment path."],
  ["Next", "Base Sepolia public demo, merchant catalog publishing, x402 normalizer, hosted dashboard, and early merchant/API-provider pilots."],
  ["Then", "Reputation scoring, privacy controls, dispute workflow UX, facilitator integrations, and production deployment on Base."],
  ["Option", "If activity warrants it, evolve selected primitives into predeploys or chain-native modules."],
];

export default function InvestorsPage() {
  return (
    <div className="bg-[#080b0f] text-text">
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,#080b0f_0%,#10151b_48%,#071412_100%)]" />
        <div className="relative mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-medium uppercase tracking-normal text-emerald-300">
              Investor overview
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
              Commerce infrastructure for the autonomous buyer economy
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
              Cortex is building the trust and transaction layer agents need to buy from
              merchants: discovery, payment policy, quote commitments, receipts, disputes,
              reputation signals, and machine-readable settlement data on Base.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/overview"
                className="rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#06110d] transition-colors hover:bg-emerald-300"
              >
                Product overview
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg border border-border bg-[#111820] px-5 py-3 text-sm font-semibold text-text transition-colors hover:border-emerald-300/70"
              >
                Live dashboard
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-[#0d1319]/95 shadow-2xl shadow-black/40">
            <div className="border-b border-border px-5 py-4">
              <div className="text-sm font-semibold text-emerald-200">Investment thesis</div>
              <div className="mt-1 text-xs text-muted">Agents need commerce infrastructure, not just wallets.</div>
            </div>
            <div className="grid gap-3 p-5">
              <PitchMetric label="Network wedge" value="Base" />
              <PitchMetric label="Payment scope" value="Transfers, swaps, x402" />
              <PitchMetric label="Protocol fee today" value="0 bps, instrumented" />
              <PitchMetric label="First buyer" value="Developers building agent commerce" />
            </div>
          </div>
        </div>
      </section>

      <Section eyebrow="Market" title="Autonomous buying creates a new merchant problem">
        <div className="grid gap-4 lg:grid-cols-3">
          {MARKET_SHIFTS.map((item) => (
            <article key={item} className="rounded-lg border border-border bg-[#10161d] p-5">
              <p className="text-sm leading-6 text-muted">{item}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section eyebrow="Product" title="Cortex makes agent transactions verifiable">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PRODUCT.map(([title, body]) => (
            <article key={title} className="min-h-40 rounded-lg border border-border bg-[#10161d] p-5">
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
            </article>
          ))}
        </div>
      </Section>

      <section className="border-b border-border bg-[#0b1114] py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-amber-300">Why now</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal">Payments are improving faster than commerce trust</h2>
            <p className="mt-5 text-base leading-7 text-muted">
              Wallets and x402 can move value. Cortex focuses on the surrounding trust system:
              who is selling, what service was promised, what the agent was allowed to spend,
              what payment terms were accepted, what was delivered, and what happened when a
              transaction failed.
            </p>
          </div>
          <div className="grid gap-3">
            <ComparisonRow left="Payment" right="Policy-aware commerce" />
            <ComparisonRow left="Directory listing" right="Verifiable merchant and service state" />
            <ComparisonRow left="API response" right="Receipt, result hash, and dispute trail" />
            <ComparisonRow left="Generic wallet" right="Delegated agent budget and replay protection" />
          </div>
        </div>
      </section>

      <Section eyebrow="Business model" title="Monetization starts with infrastructure, not a tax">
        <div className="grid gap-4 md:grid-cols-2">
          {BUSINESS.map(([title, body]) => (
            <article key={title} className="rounded-lg border border-border bg-[#10161d] p-5">
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section eyebrow="Roadmap" title="Protocol first, chain optional">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ROADMAP.map(([label, body]) => (
            <article key={label} className="rounded-lg border border-border bg-[#10161d] p-5">
              <div className="text-sm font-semibold text-emerald-200">{label}</div>
              <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
            </article>
          ))}
        </div>
      </Section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="rounded-lg border border-border bg-[#10161d] p-6 md:p-8">
            <p className="text-sm font-medium uppercase tracking-normal text-cyan-300">The ask</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal">
              Turn the Base Sepolia demo into a pilot-ready commerce network
            </h2>
            <p className="mt-5 max-w-3xl text-base leading-7 text-muted">
              The next milestone is a public testnet run with hosted dashboard, merchant catalog
              publishing, x402 normalization, direct transfer and swap examples, and a small set
              of merchant/API-provider pilots that prove agents can safely buy useful services.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 max-w-5xl">
          <p className="text-sm font-medium uppercase tracking-normal text-emerald-300">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">{title}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}

function PitchMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-[#111820] p-4">
      <div className="text-xs uppercase tracking-normal text-muted">{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}

function ComparisonRow({ left, right }: { left: string; right: string }) {
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-[#101820] p-4 sm:grid-cols-[0.85fr_1.15fr]">
      <div className="text-sm text-muted">{left}</div>
      <div className="text-sm font-semibold text-text">{right}</div>
    </div>
  );
}
