import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cortex Commerce Protocol — Cortex",
  description:
    "A Base-native protocol for agentic commerce: merchant discovery, payment policies, quotes, receipts, disputes, and machine-readable settlement data.",
};

const CAPABILITIES = [
  {
    title: "Merchant registry",
    body: "Merchants, payout addresses, service catalogs, facilitator preferences, and content hashes are anchored onchain so agents can verify who they are paying.",
  },
  {
    title: "Service discovery",
    body: "Services publish machine-readable metadata for capabilities, pricing, inputs, outputs, privacy terms, refund terms, and required attestations.",
  },
  {
    title: "Quote commitments",
    body: "Every purchase can bind merchant, service, agent, token, amount, payment rail, payment nonce, resource hash, terms hash, optional x402 payload hash, and fee terms.",
  },
  {
    title: "Receipts and reputation",
    body: "Settled work produces onchain receipt signals that can feed analytics, agent memory, merchant quality scores, and dispute history.",
  },
  {
    title: "Refund and dispute primitives",
    body: "Receipts can be challenged and resolved onchain, creating shared evidence for agents and merchants without forcing every workflow into escrow on day one.",
  },
  {
    title: "Delegated budgets",
    body: "Smart accounts and signed payment policies let humans set merchant, token, target, facilitator, per-payment, and daily limits for transfers, swaps, and x402 payments.",
  },
];

const FLOW = [
  "A merchant registers services and publishes a signed catalog.",
  "An agent discovers the service, checks policy, and requests a quote.",
  "The merchant commits the quote onchain with payment terms for a transfer, swap, facilitator, or x402 flow.",
  "The payment executes through the selected rail and a receipt is recorded.",
  "Analytics, disputes, and reputation become queryable protocol state.",
];

const STATS = [
  ["Built on", "Base"],
  ["Payment rails", "Wallets + x402"],
  ["Policy layer", "Smart accounts"],
  ["Data access", "API + dashboard"],
];

export default function OverviewPage() {
  return (
    <div className="bg-[#080b0f] text-text">
      <section className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,#080b0f_0%,#10151b_46%,#071412_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
        <div className="relative mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-medium uppercase tracking-normal text-emerald-300">
              Cortex Commerce Protocol
            </p>
            <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
              The commerce layer for autonomous agents on Base
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
              Cortex turns payments, service discovery, spending policy, receipts, disputes, and
              reputation into shared protocol state. Agents can buy from merchants with verifiable
              limits; merchants can accept agent payments with better context.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#06110d] transition-colors hover:bg-emerald-300"
              >
                View dashboard
              </Link>
              <Link
                href="/docs/testnet"
                className="rounded-lg border border-border bg-[#111820] px-5 py-3 text-sm font-semibold text-text transition-colors hover:border-emerald-300/70"
              >
                Deploy testnet
              </Link>
            </div>
          </div>

          <div className="relative min-h-[520px] lg:min-h-[560px]" aria-hidden="true">
            <div className="absolute left-0 right-0 top-8 mx-auto min-h-[486px] max-w-[560px] overflow-hidden rounded-lg border border-border bg-[#0d1319]/90 shadow-2xl shadow-black/40">
              <div className="grid min-h-[486px] grid-rows-[64px_minmax(0,1fr)_auto]">
                <div className="flex items-center justify-between border-b border-border px-5">
                  <span className="text-sm font-semibold text-emerald-200">Agent purchase graph</span>
                  <span className="text-xs text-muted">Base Sepolia</span>
                </div>
                <div className="grid grid-cols-3 gap-3 p-5">
                  <VisualNode title="Agent" detail="Budget + policy" tone="cyan" />
                  <VisualNode title="Quote" detail="Terms hash" tone="amber" />
                  <VisualNode title="Merchant" detail="Service catalog" tone="green" />
                  <VisualRail />
                  <VisualNode title="Payment" detail="Transfer / swap / x402" tone="blue" />
                  <VisualRail />
                  <VisualNode title="Receipt" detail="Settlement" tone="green" />
                  <VisualNode title="Dispute" detail="Resolution" tone="amber" />
                  <VisualNode title="Analytics" detail="Protocol data" tone="cyan" />
                </div>
                <div className="grid grid-cols-4 border-t border-border">
                  {STATS.map(([label, value]) => (
                    <div key={label} className="border-r border-border px-4 py-3 last:border-r-0">
                      <div className="text-[11px] uppercase tracking-normal text-muted">{label}</div>
                      <div className="mt-1 text-sm font-semibold">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-[#0b1015] py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-normal text-cyan-300">Why it exists</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
              Agentic commerce needs more than a payment link
            </h2>
            <p className="mt-5 text-base leading-7 text-muted">
              Wallet-to-wallet transfers and swaps should work by default. x402 adds a powerful
              web-native acceptance path, but Cortex is the protocol layer around all of those
              payments: discovery, policy checks, quote commitments, proof of fulfillment, refund
              signals, dispute history, and analytics that both agents and merchants can verify.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-border py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-normal text-amber-300">Protocol modules</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal">What Cortex provides</h2>
            </div>
            <Link href="/docs/contracts" className="text-sm font-medium text-emerald-300 hover:text-emerald-200">
              Contract reference
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <article key={item.title} className="min-h-44 rounded-lg border border-border bg-[#10161d] p-5">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-[#0b1114] py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-emerald-300">Transaction lifecycle</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal">From discovery to reputation</h2>
            <p className="mt-5 text-base leading-7 text-muted">
              The protocol keeps the high-value trust points onchain while leaving rich service
              metadata and execution data in content-addressed offchain documents. That keeps the
              system practical on Base while preserving verifiability for agents.
            </p>
          </div>
          <ol className="space-y-3">
            {FLOW.map((item, index) => (
              <li key={item} className="flex gap-4 rounded-lg border border-border bg-[#101820] p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-400/15 text-sm font-semibold text-emerald-200">
                  {index + 1}
                </span>
                <span className="pt-1 text-sm leading-6 text-muted">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-normal text-cyan-300">Positioning</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal">Start as a protocol, not a new chain</h2>
            </div>
            <div className="lg:col-span-2">
              <p className="text-base leading-7 text-muted">
                Cortex is designed to live on Base first, taking advantage of existing stablecoins,
                ERC20 liquidity, wallets, explorers, and developer distribution. If agentic commerce
                volume grows enough to justify deeper execution changes, the same primitives can
                become predeploys or chain-native modules later.
              </p>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <Metric label="Current path" value="Base protocol" />
                <Metric label="Revenue posture" value="Instrument first" />
                <Metric label="Future option" value="Agent-native chain" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function VisualNode({
  title,
  detail,
  tone,
}: {
  title: string;
  detail: string;
  tone: "green" | "cyan" | "amber" | "blue";
}) {
  const tones = {
    green: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
    cyan: "border-cyan-400/40 bg-cyan-400/10 text-cyan-100",
    amber: "border-amber-400/40 bg-amber-400/10 text-amber-100",
    blue: "border-sky-400/40 bg-sky-400/10 text-sky-100",
  };

  return (
    <div className={`flex min-h-20 flex-col justify-between rounded-lg border p-3 ${tones[tone]}`}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted">{detail}</div>
    </div>
  );
}

function VisualRail() {
  return (
    <div className="flex min-h-20 items-center justify-center">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-[#10161d] p-5">
      <div className="text-xs uppercase tracking-normal text-muted">{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}
