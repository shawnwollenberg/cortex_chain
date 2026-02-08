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
