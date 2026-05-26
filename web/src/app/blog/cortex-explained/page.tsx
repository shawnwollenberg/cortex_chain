import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cortex Explained Simply",
  description:
    "A high-school-level explanation of Cortex, the Base-native protocol for agentic commerce.",
};

const SECTIONS = [
  {
    title: "The Problem",
    body: "AI agents are starting to do real work online. They can search, compare, negotiate, buy, and call services. But money makes things serious. If an agent is going to spend money, it needs rules, receipts, and proof.",
  },
  {
    title: "The Big Idea",
    body: "Cortex is like a commerce rulebook and receipt system for AI agents. It helps agents know who they are paying, what they are buying, how much they are allowed to spend, and what proof exists after the transaction.",
  },
  {
    title: "Why Base",
    body: "Cortex runs on Base first because Base already has wallets, stablecoins, ERC-20 tokens, explorers, and users. That means agents can use existing internet money instead of waiting for a brand-new chain and new tokens.",
  },
];

const PIECES = [
  ["Agent identity", "An agent can register who owns it, where its metadata lives, and what it is capable of doing."],
  ["Smart account policy", "A human can give an agent a wallet with rules, like daily spending limits or which merchants it can pay."],
  ["Merchant registry", "Merchants can put a basic record onchain so agents can verify who they are dealing with."],
  ["Service discovery", "Merchants can list services, like data enrichment or image generation, with metadata agents can read."],
  ["Quote commitments", "Before payment, a merchant can lock in the important terms: service, price, token, payment method, deadline, and terms hash."],
  ["Receipts", "After payment, Cortex records that settlement happened and links it to the quote and result."],
  ["Disputes and trust signals", "If something goes wrong, disputes and trust signals create a history that future agents and merchants can check."],
  ["Attestations", "Trusted parties can sign claims, like whether a merchant owns a website or whether a service passed a safety review."],
  ["API and dashboard", "The indexer turns onchain events into easy API responses and dashboard views."],
];

const FLOW = [
  "A merchant registers itself and its services.",
  "An agent finds a service through the API or a marketplace.",
  "The agent checks the merchant, service metadata, reputation, and attestations.",
  "The merchant commits a quote onchain.",
  "The agent checks its spending policy and pays through a wallet transfer, swap, facilitator, or x402.",
  "A receipt is recorded.",
  "The result, fulfillment proof, dispute status, and trust signals become queryable data.",
];

export default function CortexExplainedPage() {
  return (
    <article className="bg-[#080b0f] text-text">
      <section className="border-b border-border py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-4">
          <p className="mb-4 text-sm font-medium uppercase tracking-normal text-emerald-300">
            Cortex explained simply
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
            What Cortex is, in plain English
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted">
            Imagine AI agents are like digital employees. They can research, shop, book,
            compare prices, and pay for online services. Cortex is the system that helps
            those agents spend money responsibly and leave a clear record of what happened.
          </p>
        </div>
      </section>

      <section className="border-b border-border py-12">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 md:grid-cols-3">
          {SECTIONS.map((section) => (
            <div key={section.title} className="rounded-lg border border-border bg-[#10161d] p-5">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted">{section.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-border py-14">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-3xl font-semibold tracking-normal">A Simple Analogy</h2>
          <div className="mt-6 space-y-5 text-base leading-8 text-muted">
            <p>
              Think about a teenager getting a debit card for the first time. A parent might say:
              you can spend up to $50 per day, only at approved stores, and you need receipts.
            </p>
            <p>
              Cortex gives AI agents a similar setup. The agent can act on its own, but the
              wallet has rules. The merchants are checkable. The price quote is recorded.
              The receipt is saved. If something goes wrong, there is a dispute trail.
            </p>
            <p>
              Without Cortex, agent payments can feel like: “Trust me, I paid the right person
              for the right thing.” With Cortex, the agent can show the policy, quote, payment
              rail, receipt, and reputation data.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-border py-14">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-3xl font-semibold tracking-normal">The Main Pieces</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {PIECES.map(([title, body]) => (
              <div key={title} className="rounded-lg border border-border bg-[#10161d] p-5">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-[#0b1114] py-14">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-normal">How a Purchase Works</h2>
            <p className="mt-5 text-base leading-7 text-muted">
              Cortex does not force every payment to use one method. Agents can use normal
              wallet transfers, token transfers, swaps, facilitator-mediated payments, or x402.
              The important part is that the terms and receipt are verifiable.
            </p>
          </div>
          <ol className="space-y-3">
            {FLOW.map((step, index) => (
              <li key={step} className="flex gap-4 rounded-lg border border-border bg-[#101820] p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-400/15 text-sm font-semibold text-emerald-200">
                  {index + 1}
                </span>
                <span className="pt-1 text-sm leading-6 text-muted">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b border-border py-14">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-3xl font-semibold tracking-normal">What Attestations Add</h2>
          <p className="mt-5 text-base leading-8 text-muted">
            Attestations are signed notes from trusted people or systems. They say things like:
            “This merchant controls this website,” “This service follows this schema,” or
            “This result came from a verified source.” Agents can use those signed notes as
            evidence before spending money or trusting a result.
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-3xl font-semibold tracking-normal">The Short Version</h2>
          <p className="mt-5 text-lg leading-8 text-muted">
            Cortex is infrastructure for agentic commerce. It helps AI agents know who they are
            paying, what they are buying, what they are allowed to spend, what payment method
            was used, whether the work was fulfilled, and what reputation history exists.
          </p>
          <p className="mt-5 text-base leading-8 text-muted">
            It is not trying to replace every marketplace or payment system. It is the shared
            trust and record layer underneath them.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/overview"
              className="rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#06110d] transition-colors hover:bg-emerald-300"
            >
              View overview
            </Link>
            <Link
              href="/docs/examples"
              className="rounded-lg border border-border px-5 py-3 text-sm font-semibold text-muted transition-colors hover:border-cyan-300/70 hover:text-text"
            >
              See examples
            </Link>
          </div>
        </div>
      </section>
    </article>
  );
}
