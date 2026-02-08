export default function DataFlowDiagram() {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px] p-8">
        {/* Row 1: Agent Runtime */}
        <div className="flex justify-center mb-6">
          <Box
            label="Agent Runtime"
            sub="Signs EIP-712 intents, holds private key"
            gradient
          />
        </div>

        {/* Arrows down */}
        <div className="flex justify-center gap-40 mb-6">
          <Arrow label="submitIntent()" />
          <Arrow label="registerAgent()" />
        </div>

        {/* Row 2: IntentBook + AgentRegistry */}
        <div className="flex justify-center gap-8 mb-6">
          <Box label="IntentBook" sub="EIP-712 + constraints" />
          <Box label="AgentRegistry" sub="Identity + metadata" />
        </div>

        {/* Arrow from IntentBook down + PolicyModule */}
        <div className="flex justify-center gap-8 mb-6">
          <div className="flex flex-col items-center gap-6">
            <Arrow label="IntentSubmitted event" />
            <Box label="Solver" sub="Watches events, simulates, fills" />
          </div>
          <div className="flex flex-col items-center gap-6">
            <Arrow label="fillIntent()" />
            <Box label="PolicyModule" sub="Spend limits, allowlists" />
          </div>
        </div>

        {/* Arrow down to Indexer */}
        <div className="flex justify-center mb-6">
          <Arrow label="All events" />
        </div>

        {/* Indexer */}
        <div className="flex justify-center mb-6">
          <Box label="Indexer" sub="Ingests events → Postgres" wide />
        </div>

        <div className="flex justify-center mb-6">
          <Arrow />
        </div>

        {/* Postgres */}
        <div className="flex justify-center mb-6">
          <Box label="Postgres" sub="agents, intents, fills, policies, tx_receipts" wide />
        </div>

        <div className="flex justify-center mb-6">
          <Arrow />
        </div>

        {/* API */}
        <div className="flex justify-center">
          <Box label="REST API" sub="/agents  /intents  /accounts  /tx/:hash" wide gradient />
        </div>
      </div>
    </div>
  );
}

function Box({
  label,
  sub,
  wide,
  gradient,
}: {
  label: string;
  sub: string;
  wide?: boolean;
  gradient?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 text-center ${wide ? "w-80" : "w-56"} ${
        gradient
          ? "border-accent-purple/40 bg-gradient-to-br from-accent-purple/10 to-accent-blue/10"
          : "border-border bg-surface"
      }`}
    >
      <div className="font-semibold text-sm">{label}</div>
      <div className="text-xs text-muted mt-1">{sub}</div>
    </div>
  );
}

function Arrow({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {label && <span className="text-xs text-muted">{label}</span>}
      <div className="w-px h-6 bg-border" />
      <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-border" />
    </div>
  );
}
