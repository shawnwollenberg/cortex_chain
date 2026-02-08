const STEPS = [
  {
    step: "1",
    title: "Register identity",
    description: "Agent calls AgentRegistry with metadata, pubkey, and capabilities hash.",
  },
  {
    step: "2",
    title: "Configure policies",
    description: "Owner sets spend limits, target allowlists, and function-level permissions via PolicyModule.",
  },
  {
    step: "3",
    title: "Sign & submit intent",
    description: "Agent signs an EIP-712 typed intent with constraints (max input, min output, deadline) and submits it to IntentBook.",
  },
  {
    step: "4",
    title: "Solver fills intent",
    description: "Solver watches for IntentSubmitted events, validates constraints, simulates via eth_call, and calls fillIntent().",
  },
  {
    step: "5",
    title: "Query state",
    description: "Indexer ingests all events into Postgres. REST API and MCP server provide machine-readable access.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-4xl px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
          How it works
        </h2>

        <div className="space-y-10">
          {STEPS.map((s, i) => (
            <div key={s.step} className="flex items-start gap-4 md:grid md:grid-cols-[1fr_2.5rem_1fr] md:gap-6 md:items-start">
              {/* Left content (even steps) */}
              <div className={`hidden md:block ${i % 2 === 0 ? "text-right" : ""}`}>
                {i % 2 === 0 && (
                  <>
                    <h3 className="font-semibold mb-1">{s.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{s.description}</p>
                  </>
                )}
              </div>

              {/* Step number (center column) */}
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-purple to-accent-blue text-sm font-bold text-white">
                {s.step}
              </div>

              {/* Right content (odd steps) / mobile content */}
              <div className={`flex-1 md:flex-none ${i % 2 !== 0 ? "" : "md:hidden"}`}>
                <h3 className="font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{s.description}</p>
              </div>

              {/* Right content (odd steps, desktop only) */}
              {i % 2 !== 0 && (
                <div className="hidden md:block">
                  <h3 className="font-semibold mb-1">{s.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{s.description}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
