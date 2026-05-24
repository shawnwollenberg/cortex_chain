const STEPS = [
  {
    step: "1",
    title: "Publish services",
    description: "Merchants register services, metadata hashes, capability hashes, and payment preferences in CommerceRegistry.",
  },
  {
    step: "2",
    title: "Set agent budgets",
    description: "Owners configure spend limits, target allowlists, swap permissions, facilitator budgets, and x402 payment policy.",
  },
  {
    step: "3",
    title: "Commit quote terms",
    description: "A merchant commits a quote that binds service, agent, token, amount, payment rail, expiry, nonce, resource hash, and terms hash.",
  },
  {
    step: "4",
    title: "Execute payment",
    description: "Payment can happen through wallet transfer, ERC-20 transfer, swap, facilitator-mediated settlement, or x402.",
  },
  {
    step: "5",
    title: "Record signals",
    description: "Receipts, disputes, solver activity, and analytics are indexed for agents, dashboards, marketplaces, and MCP tools.",
  },
];

function StepContent({ title, description }: { title: string; description: string }) {
  return (
    <>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{description}</p>
    </>
  );
}

export default function HowItWorks() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-4xl px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
          How it works
        </h2>

        <div className="space-y-10">
          {STEPS.map((s, i) => {
            const isLeft = i % 2 === 0;

            return (
              <div key={s.step} className="flex items-start gap-4 md:grid md:grid-cols-[1fr_2.5rem_1fr] md:gap-6 md:items-start">
                {/* Left column (desktop only) */}
                <div className={`hidden md:block ${isLeft ? "text-right" : ""}`}>
                  {isLeft && <StepContent title={s.title} description={s.description} />}
                </div>

                {/* Center: step number */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-purple to-accent-blue text-sm font-bold text-white">
                  {s.step}
                </div>

                {/* Right column: always visible on mobile, only odd steps on desktop */}
                <div className={`flex-1 md:flex-none ${isLeft ? "md:hidden" : ""}`}>
                  <StepContent title={s.title} description={s.description} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
