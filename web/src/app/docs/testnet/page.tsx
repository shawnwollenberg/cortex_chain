import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "Testnet Deployment — Cortex Docs",
  description: "Deploy the full Cortex stack to Base Sepolia or OP Sepolia.",
  alternates: { types: { "text/markdown": "/docs/testnet-deploy.md" } },
};

export default function TestnetDeployPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Testnet Deployment</h1>
      <p className="text-muted mb-10">
        Deploy the full Cortex stack (contracts + offchain services) to a public testnet.
      </p>

      <p className="text-sm text-muted mb-6">
        <strong>Recommended testnet:</strong> Base Sepolia &mdash; an OP Stack L2 with fast blocks (~2s), free faucets, and a good block explorer.
      </p>

      <div className="overflow-x-auto mb-10">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-muted"><th className="pb-3 pr-4"></th><th className="pb-3 pr-4">Base Sepolia</th><th className="pb-3">OP Sepolia</th></tr></thead>
          <tbody className="divide-y divide-border">
            <tr><td className="py-2 pr-4 font-medium">Chain ID</td><td className="py-2 pr-4 font-mono text-xs">84532</td><td className="py-2 font-mono text-xs">11155420</td></tr>
            <tr><td className="py-2 pr-4 font-medium">RPC</td><td className="py-2 pr-4 font-mono text-xs">https://sepolia.base.org</td><td className="py-2 font-mono text-xs">https://sepolia.optimism.io</td></tr>
            <tr><td className="py-2 pr-4 font-medium">Explorer</td><td className="py-2 pr-4 text-muted">sepolia.basescan.org</td><td className="py-2 text-muted">sepolia-optimistic.etherscan.io</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold mb-4">Prerequisites</h2>
      <ul className="list-disc list-inside space-y-2 text-sm text-muted mb-8">
        <li><strong>Foundry</strong> &mdash; <code>forge</code>, <code>cast</code></li>
        <li><strong>Node.js</strong> &gt;= 18</li>
        <li><strong>PostgreSQL client tools</strong> &mdash; <code>psql</code></li>
        <li><strong>Three wallets</strong> &mdash; deployer, solver, agent (each needs testnet ETH)</li>
      </ul>

      <h2 className="text-xl font-semibold mb-4">1. Get Testnet ETH</h2>
      <p className="text-sm text-muted mb-4">
        Fund your deployer wallet with Base Sepolia ETH from any of these faucets:
      </p>
      <ul className="list-disc list-inside space-y-2 text-sm text-muted mb-8">
        <li><a href="https://www.alchemy.com/faucets/base-sepolia" className="text-accent hover:underline">Alchemy Faucet</a> &mdash; requires free Alchemy account</li>
        <li><a href="https://portal.cdp.coinbase.com/products/faucet" className="text-accent hover:underline">Coinbase Developer Platform</a> &mdash; requires Coinbase account</li>
        <li><a href="https://thirdweb.com/base-sepolia-testnet" className="text-accent hover:underline">thirdweb Faucet</a> &mdash; no account required</li>
      </ul>

      <h2 className="text-xl font-semibold mb-4">2. Configure Environment</h2>
      <CodeBlock language="bash">{`cp ops/.env.testnet.example ops/.env.testnet`}</CodeBlock>
      <p className="text-sm text-muted mt-3 mb-2">Edit <code>ops/.env.testnet</code> with your values:</p>
      <CodeBlock language="bash">{`RPC_URL=https://sepolia.base.org
DATABASE_URL=postgres://user:pass@host:5432/cortex
DEPLOYER_KEY=0x<your-deployer-private-key>
SOLVER_PRIVATE_KEY=0x<your-solver-private-key>
AGENT_PRIVATE_KEY=0x<your-agent-private-key>`}</CodeBlock>
      <p className="text-sm text-muted mt-3 mb-8">
        Never commit private keys. The <code>.env.testnet</code> file is gitignored.
      </p>

      <h2 className="text-xl font-semibold mb-4">3. Deploy Contracts</h2>
      <CodeBlock language="bash">{`source ops/.env.testnet
./ops/deploy-testnet.sh`}</CodeBlock>
      <p className="text-sm text-muted mt-3 mb-8">
        Deploys AgentRegistry, IntentBook, PolicyModule, and AttestationRegistry to Base Sepolia.
        Contract addresses are written to <code>ops/.env.testnet</code>.
      </p>

      <h2 className="text-xl font-semibold mb-4">4. Set Up Postgres</h2>
      <p className="text-sm text-muted mb-4">
        You need a Postgres instance accessible from wherever you run the services.
      </p>
      <ul className="list-disc list-inside space-y-2 text-sm text-muted mb-4">
        <li><strong><a href="https://railway.app/" className="text-accent hover:underline">Railway</a></strong> &mdash; simplest option, supports Node.js + Postgres in one platform</li>
        <li><strong><a href="https://neon.tech/" className="text-accent hover:underline">Neon</a></strong> &mdash; serverless Postgres with a free tier</li>
        <li><strong><a href="https://supabase.com/" className="text-accent hover:underline">Supabase</a></strong> &mdash; managed Postgres with a generous free tier</li>
      </ul>
      <p className="text-sm text-muted mb-8">
        Copy the connection string and update <code>DATABASE_URL</code> in <code>ops/.env.testnet</code>.
      </p>

      <h2 className="text-xl font-semibold mb-4">5. Run Migrations</h2>
      <CodeBlock language="bash">{`source ops/.env.testnet
psql "$DATABASE_URL" -f indexer/migrations/001_init.sql`}</CodeBlock>
      <p className="text-sm text-muted mt-3 mb-8">
        Creates the <code>agents</code>, <code>intents</code>, <code>fills</code>, <code>policies</code>, and <code>tx_receipts</code> tables.
      </p>

      <h2 className="text-xl font-semibold mb-4">6. Start Services</h2>
      <p className="text-sm text-muted mb-4">
        Source the testnet env and start each service:
      </p>
      <CodeBlock language="bash">{`source ops/.env.testnet

# Indexer — polls Base Sepolia for events, writes to Postgres
cd indexer && npm run build && node dist/index.js

# Solver — watches IntentSubmitted, simulates, fills
cd solver && npm run build && node dist/index.js

# API — REST server on port 3001
cd api && npm run build && node dist/index.js`}</CodeBlock>
      <p className="text-sm text-muted mt-3 mb-4">
        Or as background processes:
      </p>
      <CodeBlock language="bash">{`source ops/.env.testnet

cd indexer && npm run build && nohup node dist/index.js > ../ops/indexer.log 2>&1 &
cd ../solver && npm run build && nohup node dist/index.js > ../ops/solver.log 2>&1 &
cd ../api && npm run build && nohup node dist/index.js > ../ops/api.log 2>&1 &`}</CodeBlock>

      <h2 className="text-xl font-semibold mb-4 mt-10">7. Verify</h2>
      <h3 className="text-lg font-semibold mb-2">Check the block explorer</h3>
      <p className="text-sm text-muted mb-4">
        Visit <code>https://sepolia.basescan.org/address/&lt;AGENT_REGISTRY_ADDRESS&gt;</code> to confirm the contract is deployed.
      </p>

      <h3 className="text-lg font-semibold mb-2">Hit the API</h3>
      <CodeBlock language="bash">{`# Health check
curl http://localhost:3001/health

# List agents
curl http://localhost:3001/agents?owner=0x0000000000000000000000000000000000000000

# List open intents
curl http://localhost:3001/intents?status=open`}</CodeBlock>

      <h3 className="text-lg font-semibold mb-2 mt-6">Register a test agent</h3>
      <CodeBlock language="bash">{`source ops/.env.testnet

cast send "$AGENT_REGISTRY_ADDRESS" \\
  "registerAgent(string,bytes,bytes32)" \\
  "ipfs://test-agent" \\
  "0xaabb" \\
  "0x0000000000000000000000000000000000000000000000000000000000000001" \\
  --rpc-url "$RPC_URL" \\
  --private-key "$AGENT_PRIVATE_KEY"`}</CodeBlock>
      <p className="text-sm text-muted mt-3 mb-8">
        Wait a few seconds for the indexer, then query <code>curl http://localhost:3001/agents/1</code>.
      </p>

      <h2 className="text-xl font-semibold mb-4">Alternative: OP Sepolia</h2>
      <p className="text-sm text-muted mb-4">
        The same steps apply to OP Sepolia. Change:
      </p>
      <CodeBlock language="bash">{`RPC_URL=https://sepolia.optimism.io`}</CodeBlock>
      <p className="text-sm text-muted mt-3 mb-8">
        The deploy script auto-detects the chain ID. Use the OP Sepolia explorer at <code>sepolia-optimistic.etherscan.io</code>.
      </p>

      <h2 className="text-xl font-semibold mb-4">Troubleshooting</h2>
      <ul className="space-y-3 text-sm">
        <li><strong>Deploy fails with &ldquo;insufficient funds&rdquo;:</strong> <span className="text-muted">Get more testnet ETH from a faucet. Deployment costs ~0.01 ETH.</span></li>
        <li><strong>Indexer not picking up events:</strong> <span className="text-muted">Check that <code>RPC_URL</code> and contract addresses match. The indexer may take 5-10 seconds.</span></li>
        <li><strong>Solver not filling intents:</strong> <span className="text-muted">Verify <code>SOLVER_PRIVATE_KEY</code> has testnet ETH. Check <code>ops/solver.log</code>.</span></li>
        <li><strong>Database connection refused:</strong> <span className="text-muted">Ensure Postgres is accessible and <code>DATABASE_URL</code> is correct. Test with <code>psql &quot;$DATABASE_URL&quot; -c &quot;SELECT 1&quot;</code>.</span></li>
      </ul>
    </div>
  );
}
