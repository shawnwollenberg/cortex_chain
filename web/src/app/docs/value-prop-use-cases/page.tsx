import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Value Proposition and Use Cases — Cortex Docs",
  description:
    "Strategic value proposition analysis and practical use cases for the Cortex agentic commerce protocol.",
  alternates: { types: { "text/markdown": "/docs/value-prop-use-cases.md" } },
};

const VALUE_PROPS = [
  {
    audience: "AI agents",
    points: [
      "Discover registered merchants and services before spending.",
      "Verify hosted catalog, quote request, and quote response documents by hash.",
      "Verify quote terms, payment rail, token, amount, resource, and expiry.",
      "Spend under delegated merchant, token, facilitator, per-payment, and daily limits.",
      "Use wallet transfers, ERC-20 transfers, swaps, facilitator flows, or x402.",
      "Record receipts, disputes, and reputation signals for future decisions.",
    ],
  },
  {
    audience: "Merchants",
    points: [
      "Publish verifiable merchant, payout, service, and capability records.",
      "Exchange hosted quote request and quote response documents with agents.",
      "Commit exact quote terms before payment.",
      "Accept multiple payment rails without rebuilding trust infrastructure.",
      "Build portable fulfillment history through receipts and trust signals.",
      "Surface agent refund-abuse or dispute patterns.",
    ],
  },
  {
    audience: "Infrastructure partners",
    points: [
      "Make agent payments legible, policy-controlled, and auditable.",
      "Standardize merchant, service, quote, receipt, dispute, and reputation data.",
      "Drive Base stablecoin and ERC-20 transaction volume.",
      "Feed wallets, facilitators, marketplaces, dashboards, risk engines, and support tools.",
    ],
  },
];

const USE_CASES = [
  [
    "Agent buys an API result with x402",
    "A merchant publishes a service catalog, the agent submits a hosted quote request, the merchant returns an x402 quote response, Cortex binds it into a quote hash, and a receipt records settlement.",
  ],
  [
    "Agent pays a merchant with USDC",
    "A merchant publishes a hosted quote response for a direct stablecoin payment, the agent verifies the quote, pays from its smart account, and the receipt adds commerce context.",
  ],
  [
    "Agent swaps into the required token",
    "The agent holds one asset, the merchant requires another, and Cortex policy controls both the swap target and final merchant payment.",
  ],
  [
    "Enterprise gives an agent a daily budget",
    "A company allows specific merchants, tokens, facilitators, rails, and spend limits while receipts create an audit trail.",
  ],
  [
    "Merchant builds reputation with agents",
    "A merchant's completed orders, fulfillment signals, and dispute history become portable trust data across marketplaces and agents.",
  ],
  [
    "Refund and dispute workflow",
    "Agents can flag missing or malformed fulfillment, while merchants can identify repeated refund abuse from agents.",
  ],
  [
    "Marketplace uses Cortex as its trust backend",
    "Marketplaces can index Cortex data for discovery and ranking while agents verify claims against Base.",
  ],
  [
    "Base or Coinbase drives agentic stablecoin volume",
    "Cortex creates measurable onchain commerce activity with merchant count, service count, rail mix, receipts, disputes, and active agents.",
  ],
  [
    "Compliance-aware agent purchasing",
    "Agents can restrict purchases to verified merchants, approved service categories, and attestable compliance metadata.",
  ],
  [
    "Agent-to-agent service commerce",
    "One agent can register as a merchant, sell a service, receive payment, and build reputation with other agents.",
  ],
];

const WEDGES = [
  [
    "Paid API calls for agents",
    "The strongest starting wedge because agents already need data, inference, enrichment, research, and automation APIs.",
  ],
  [
    "Enterprise agent spend controls",
    "A clear buyer problem: companies need agent autonomy without unconstrained wallets.",
  ],
  [
    "Merchant reputation for agent buyers",
    "Every transaction can create trust data that improves future routing and discovery.",
  ],
];

const GAPS = [
  ["Product", "Browser wallet transaction flows, canonical JSON and schema validation, seeded hosted demos, rail execution adapters, x402 normalization, and cleaner direct transfer/swap receipt semantics."],
  ["Trust", "Merchant verification, service attestations, agent risk signals, dispute resolution roles, and explainable reputation scoring."],
  ["Enterprise", "Organization policy, team roles, approval flows, budget dashboards, accounting exports, compliance metadata, and vendor review attestations."],
  ["Ecosystem", "Wallet and smart account integrations, x402 facilitator integrations, merchant templates, agent framework examples, marketplace integrations, and partner analytics."],
];

export default function ValuePropUseCasesPage() {
  return (
    <div>
      <div className="mb-10">
        <p className="text-sm font-medium text-accent mb-3">Strategy</p>
        <h1 className="text-3xl font-bold mb-4">Value Proposition and Use Cases</h1>
        <p className="text-muted max-w-3xl">
          Cortex is the commerce coordination layer for autonomous agents. Payments move value;
          Cortex makes the surrounding commerce context trustworthy: merchant identity, service
          discovery, delegated budgets, quote commitments, receipts, disputes, reputation, and analytics.
        </p>
        <a
          href="/docs/value-prop-use-cases.md"
          className="mt-5 inline-flex text-sm font-medium text-accent hover:underline"
        >
          View full markdown analysis
        </a>
      </div>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Core Value Proposition</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {VALUE_PROPS.map((group) => (
            <div key={group.audience} className="rounded-lg border border-border bg-surface p-5">
              <h3 className="font-semibold mb-3">{group.audience}</h3>
              <ul className="space-y-2 text-sm text-muted">
                {group.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Use-Case Examples</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {USE_CASES.map(([title, body], index) => (
            <div key={title} className="rounded-lg border border-border bg-surface p-5">
              <p className="text-xs font-mono text-muted mb-2">Use case {index + 1}</p>
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">High-Value Initial Wedges</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {WEDGES.map(([title, body]) => (
            <div key={title} className="rounded-lg border border-border bg-surface p-5">
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">What Still Needs to Be Added or Strengthened</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="pb-3 pr-4">Area</th>
                <th className="pb-3">Needed work</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {GAPS.map(([area, work]) => (
                <tr key={area}>
                  <td className="py-4 pr-4 font-medium align-top">{area}</td>
                  <td className="py-4 text-muted">{work}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Recommended Messaging</h2>
        <div className="rounded-lg border border-border bg-surface p-5">
          <ul className="space-y-2 text-sm text-muted">
            <li>The commerce layer for autonomous agents.</li>
            <li>Policy, quotes, receipts, disputes, and reputation for agent payments.</li>
            <li>Cortex makes agent transactions verifiable.</li>
            <li>Payments move value. Cortex makes the commerce context trustworthy.</li>
            <li>Base-native infrastructure for agentic commerce.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
