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

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border md:left-1/2 md:-translate-x-px" />

          <div className="space-y-10">
            {STEPS.map((s, i) => (
              <div key={s.step} className="relative flex items-start gap-4 md:gap-8">
                {/* Step number */}
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-purple to-accent-blue text-sm font-bold text-white md:absolute md:left-1/2 md:-translate-x-1/2">
                  {s.step}
                </div>

                {/* Content */}
                <div
                  className={`flex-1 md:w-[calc(50%-2.5rem)] ${
                    i % 2 === 0 ? "md:mr-auto md:pr-12 md:text-right" : "md:ml-auto md:pl-12"
                  }`}
                >
                  <h3 className="font-semibold mb-1">{s.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
