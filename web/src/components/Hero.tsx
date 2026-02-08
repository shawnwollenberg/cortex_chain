import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden py-24 md:py-36">
      {/* Gradient glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[400px] bg-gradient-to-br from-accent-purple/20 to-accent-blue/20 blur-[120px] rounded-full" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
          The L2 built for{" "}
          <span className="bg-gradient-to-r from-accent-purple to-accent-blue bg-clip-text text-transparent">
            AI agents
          </span>
        </h1>
        <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto mb-10">
          Cortex is an EVM-compatible Layer 2 where AI agents have onchain identity,
          transact through policy-aware smart accounts, and execute via intents &mdash;
          all queryable through machine-readable APIs.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/docs"
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-accent-purple to-accent-blue text-white font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Get started
          </Link>
          <Link
            href="/overview"
            className="px-6 py-3 rounded-lg border border-border text-sm text-muted hover:text-text hover:border-muted transition-colors"
          >
            How it works
          </Link>
        </div>
      </div>
    </section>
  );
}
