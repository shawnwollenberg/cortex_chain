import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-[#080b0f]">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,#080b0f_0%,#10151b_50%,#071412_100%)]" />

      <div className="relative mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div className="max-w-3xl">
          <p className="mb-5 text-sm font-medium uppercase tracking-normal text-emerald-300">
            Cortex Commerce Protocol
          </p>
          <h1 className="text-4xl font-semibold tracking-normal leading-tight md:text-6xl">
            The commerce layer for autonomous agents on Base
        </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            Cortex gives agents and merchants shared protocol state for service discovery,
            delegated budgets, payment terms, receipts, disputes, and reputation. It supports
            wallet transfers, swaps, facilitator flows, and x402 without requiring a new chain.
        </p>
          <div className="mt-9 flex flex-wrap gap-3">
          <Link
              href="/overview"
              className="rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#06110d] transition-colors hover:bg-emerald-300"
          >
              Explore protocol
          </Link>
          <Link
              href="/dashboard"
              className="rounded-lg border border-border bg-[#111820] px-5 py-3 text-sm font-semibold text-text transition-colors hover:border-emerald-300/70"
          >
              View dashboard
          </Link>
            <Link
              href="/docs"
              className="rounded-lg border border-border px-5 py-3 text-sm font-semibold text-muted transition-colors hover:border-cyan-300/70 hover:text-text"
            >
              Read docs
            </Link>
          </div>
        </div>

        <div className="relative min-h-[420px]" aria-hidden="true">
          <div className="absolute left-0 right-0 top-6 mx-auto max-w-[560px] overflow-hidden rounded-lg border border-border bg-[#0d1319]/95 shadow-2xl shadow-black/40">
            <div className="border-b border-border px-5 py-4">
              <div className="text-sm font-semibold text-emerald-200">Agent commerce flow</div>
              <div className="mt-1 text-xs text-muted">Base-native protocol state</div>
            </div>
            <div className="grid gap-3 p-5">
              <HeroRow left="Agent" center="Policy check" right="Budget" />
              <HeroRow left="Merchant" center="Service catalog" right="Quote" />
              <HeroRow left="Payment" center="Transfer / swap / x402" right="Receipt" />
              <HeroRow left="Signals" center="Dispute + reputation" right="Analytics" />
            </div>
            <div className="grid grid-cols-3 border-t border-border">
              <HeroMetric label="Network" value="Base" />
              <HeroMetric label="Fees" value="0 bps" />
              <HeroMetric label="Access" value="API + MCP" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroRow({ left, center, right }: { left: string; center: string; right: string }) {
  return (
    <div className="grid grid-cols-[1fr_1.35fr_1fr] items-center gap-3">
      <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-3 text-sm font-semibold text-cyan-100">
        {left}
      </div>
      <div className="rounded-lg border border-border bg-[#111820] px-3 py-3 text-center text-xs text-muted">
        {center}
      </div>
      <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-3 text-right text-sm font-semibold text-emerald-100">
        {right}
      </div>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-border px-4 py-3 last:border-r-0">
      <div className="text-[11px] uppercase tracking-normal text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
