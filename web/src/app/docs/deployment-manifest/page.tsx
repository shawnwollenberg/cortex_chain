import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Deployment Manifest — Cortex Docs",
  description: "Current Cortex deployment inventory and migration checklist.",
  alternates: { types: { "text/markdown": "/docs/deployment-manifest.md" } },
};

const CONTRACTS = [
  ["AgentRegistry", "0x24ca7dc7747b0166e73a2d6d99ce677476f046f3"],
  ["IntentBook", "0x16f7e7c4856bad4dcbe61400630087dab75b229e"],
  ["PolicyModule", "0xb2686c5cc3ab7ce45acfe0091698d9b6a16c2d0c"],
  ["AttestationRegistry", "0x62631b3f111424831daa61becb2e7a4bb0f71d2f"],
  ["SolverRegistry", "0x21cf04bc864953da4c79160f820f38ef74213eea"],
  ["AttestorRegistry", "0x40f2623f177a400a5928c99f107500049a884da0"],
  ["CommerceRegistry", "0xf0bf44b28567f0b3d2370dc7af8a63335746d8d4"],
  ["SettlementAdapter", "0xbD61097Cc7b7E1F03E88Fe20E9512ff091126cb3"],
];

const MIGRATION_STEPS = [
  "Create the new repository and copy code, preserving history if practical.",
  "Create the target AWS account, deployment role, ECR repos, RDS, ECS services, load balancers, DNS, and certificates.",
  "Load secrets into the target secret store.",
  "Run database migrations against the new Postgres instance.",
  "Deploy API, indexer, and web images.",
  "Configure NEXT_PUBLIC_API_URL to the new API hostname and rebuild the web image.",
  "Confirm health, analytics, merchant, service, x402, and hosted document routes.",
  "Smoke test onboarding wallet reads and quote publishing.",
  "Point DNS to the new account after health checks pass.",
  "Keep the old deployment running until indexed block height and API behavior match.",
];

export default function DeploymentManifestPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Deployment Manifest</h1>
      <p className="text-muted mb-8">
        Current hosted deployment inventory and the checklist for moving Cortex into a new repository or AWS account.
      </p>

      <h2 className="text-xl font-semibold mb-4">Hosted URLs</h2>
      <ul className="space-y-2 text-sm text-muted">
        <li>Web dashboard and docs: <code>https://cortex.wallyweb.com</code></li>
        <li>API: <code>https://api.cortex.wallyweb.com</code></li>
        <li>Base Sepolia RPC target: <code>https://sepolia.base.org</code></li>
        <li>Indexer start block: <code>42033933</code></li>
      </ul>

      <h2 className="text-xl font-semibold mb-4 mt-10">Base Sepolia Contracts</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="pb-3 pr-4">Contract</th>
              <th className="pb-3">Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {CONTRACTS.map(([name, address]) => (
              <tr key={name}>
                <td className="py-2 pr-4 font-medium">{name}</td>
                <td className="py-2 font-mono text-xs">{address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold mb-4 mt-10">AWS Resources</h2>
      <ul className="space-y-2 text-sm text-muted">
        <li>AWS profile <code>wallyweb</code> in <code>us-east-1</code>.</li>
        <li>ECS services for web, API, and indexer.</li>
        <li>ECR image repositories, RDS/Postgres, load balancers, DNS, and TLS certificates.</li>
      </ul>

      <h2 className="text-xl font-semibold mb-4 mt-10">Migration Checklist</h2>
      <ol className="space-y-2 text-sm text-muted">
        {MIGRATION_STEPS.map((step) => <li key={step}>{step}</li>)}
      </ol>

      <h2 className="text-xl font-semibold mb-4 mt-10">Hardening Gaps</h2>
      <ul className="space-y-2 text-sm text-muted">
        <li>API authentication and rate limiting for write-heavy document routes.</li>
        <li>Scheme-specific x402 signature verification and facilitator settlement reconciliation.</li>
        <li>Full structured schema validation for catalogs, quotes, settlement plans, fulfillment, and evidence.</li>
        <li>Backup, restore, and rollback runbooks.</li>
      </ul>
    </div>
  );
}
