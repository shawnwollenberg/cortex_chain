import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "Contracts Reference — Cortex Docs",
  description: "Smart contract interfaces for AgentRegistry, IntentBook, PolicyModule, and PolicyAccount.",
  alternates: { types: { "text/markdown": "/docs/contracts.md" } },
};

export default function ContractsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Contracts Reference</h1>
      <p className="text-muted mb-10">
        Four core contracts make up the onchain layer: AgentRegistry, IntentBook, PolicyModule, and PolicyAccount.
      </p>

      {/* AgentRegistry */}
      <h2 className="text-2xl font-semibold mb-4 mt-12" id="agent-registry">AgentRegistry</h2>
      <p className="text-sm text-muted mb-6">Stores agent identity records. Agents are registered by their owner address.</p>

      <h3 className="text-lg font-semibold mb-3">Functions</h3>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-muted"><th className="pb-3 pr-4">Function</th><th className="pb-3 pr-4">Access</th><th className="pb-3">Description</th></tr></thead>
          <tbody className="divide-y divide-border">
            <tr><td className="py-2 pr-4 font-mono text-xs">registerAgent(metadataURI, pubkey, capabilitiesHash)</td><td className="py-2 pr-4">Anyone</td><td className="py-2 text-muted">Register a new agent. Returns agentId.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">updateAgent(agentId, metadataURI, capabilitiesHash)</td><td className="py-2 pr-4">Owner</td><td className="py-2 text-muted">Update agent metadata. Reverts if revoked.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">revokeAgent(agentId)</td><td className="py-2 pr-4">Owner</td><td className="py-2 text-muted">Permanently revoke an agent.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">getAgent(agentId)</td><td className="py-2 pr-4">View</td><td className="py-2 text-muted">Get agent record. Reverts if not found.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">getAgentsByOwner(owner)</td><td className="py-2 pr-4">View</td><td className="py-2 text-muted">Get all agent IDs for an owner.</td></tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-lg font-semibold mb-3">Events</h3>
      <CodeBlock language="solidity">{`event AgentRegistered(uint256 indexed agentId, address indexed owner, string metadataURI);
event AgentUpdated(uint256 indexed agentId, string metadataURI, bytes32 capabilitiesHash);
event AgentRevoked(uint256 indexed agentId);`}</CodeBlock>

      <h3 className="text-lg font-semibold mb-3 mt-6">Errors</h3>
      <CodeBlock language="solidity">{`error Unauthorized();
error AgentNotFound();
error AgentAlreadyRevoked();`}</CodeBlock>

      <hr className="border-border my-10" />

      {/* IntentBook */}
      <h2 className="text-2xl font-semibold mb-4" id="intent-book">IntentBook</h2>
      <p className="text-sm text-muted mb-6">Manages the intent lifecycle: submit, fill, cancel. Uses EIP-712 signed typed data.</p>

      <h3 className="text-lg font-semibold mb-3">EIP-712 Domain</h3>
      <CodeBlock language="text">{`name: "AgentIntentBook"
version: "1"
chainId: <chain ID>
verifyingContract: <IntentBook address>`}</CodeBlock>

      <h3 className="text-lg font-semibold mb-3 mt-6">Intent Struct</h3>
      <CodeBlock language="solidity">{`struct Intent {
    address owner;
    IntentType intentType;
    Constraints constraints;
    address inputToken;
    address outputToken;
    uint256 nonce;
}

struct Constraints {
    uint256 amountInMax;
    uint256 amountOutMin;
    uint256 deadline;
    uint16 slippageBps;
}`}</CodeBlock>

      <h3 className="text-lg font-semibold mb-3 mt-6">Functions</h3>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-muted"><th className="pb-3 pr-4">Function</th><th className="pb-3 pr-4">Access</th><th className="pb-3">Description</th></tr></thead>
          <tbody className="divide-y divide-border">
            <tr><td className="py-2 pr-4 font-mono text-xs">submitIntent(intent, v, r, s)</td><td className="py-2 pr-4">Anyone</td><td className="py-2 text-muted">Submit a signed intent. Validates signature, nonce, deadline, slippage.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">cancelIntent(intentId)</td><td className="py-2 pr-4">Owner</td><td className="py-2 text-muted">Cancel an open intent.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">fillIntent(intentId, fill)</td><td className="py-2 pr-4">Anyone</td><td className="py-2 text-muted">Fill an open intent. Validates constraints and expiry.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">getIntent(intentId)</td><td className="py-2 pr-4">View</td><td className="py-2 text-muted">Get intent data.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">getIntentStatus(intentId)</td><td className="py-2 pr-4">View</td><td className="py-2 text-muted">Get intent status (OPEN, FILLED, CANCELLED, EXPIRED).</td></tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-lg font-semibold mb-3">Events</h3>
      <CodeBlock language="solidity">{`event IntentSubmitted(uint256 indexed intentId, address indexed owner, uint256 nonce);
event IntentCancelled(uint256 indexed intentId);
event IntentFilled(uint256 indexed intentId, address indexed solver, uint256 amountIn, uint256 amountOut);`}</CodeBlock>

      <h3 className="text-lg font-semibold mb-3 mt-6">Errors</h3>
      <CodeBlock language="solidity">{`error Unauthorized();
error InvalidNonce();
error IntentExpired();
error IntentNotOpen();
error ConstraintViolation();
error InvalidSlippage();     // slippageBps > 10,000
error InvalidDeadline();     // deadline <= block.timestamp
error InvalidSignature();    // recovered signer != intent.owner`}</CodeBlock>

      <hr className="border-border my-10" />

      {/* PolicyModule */}
      <h2 className="text-2xl font-semibold mb-4" id="policy-module">PolicyModule</h2>
      <p className="text-sm text-muted mb-6">Enforces per-account policies: spend limits, target allowlists, function selector allowlists.</p>

      <h3 className="text-lg font-semibold mb-3">Functions</h3>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-muted"><th className="pb-3 pr-4">Function</th><th className="pb-3 pr-4">Access</th><th className="pb-3">Description</th></tr></thead>
          <tbody className="divide-y divide-border">
            <tr><td className="py-2 pr-4 font-mono text-xs">setSpendLimit(token, maxPerDay)</td><td className="py-2 pr-4">Account</td><td className="py-2 text-muted">Set daily spend limit. 0 removes limit.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">setTargetAllowed(target, allowed)</td><td className="py-2 pr-4">Account</td><td className="py-2 text-muted">Add/remove target from allowlist.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">setFunctionAllowed(target, selector, allowed)</td><td className="py-2 pr-4">Account</td><td className="py-2 text-muted">Allow/disallow function selector on target.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">setUseFunctionAllowlist(enabled)</td><td className="py-2 pr-4">Account</td><td className="py-2 text-muted">Enable/disable function-level checks.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">checkTransaction(target, value, data)</td><td className="py-2 pr-4">View</td><td className="py-2 text-muted">Validate against all policies.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">recordSpend(token, amount)</td><td className="py-2 pr-4">Account</td><td className="py-2 text-muted">Record spending against daily limit.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">getSpendLimit(account, token)</td><td className="py-2 pr-4">View</td><td className="py-2 text-muted">Get spend limit config.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">getSpentToday(account, token)</td><td className="py-2 pr-4">View</td><td className="py-2 text-muted">Amount spent in current 24h window.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">isTargetAllowed(account, target)</td><td className="py-2 pr-4">View</td><td className="py-2 text-muted">Check if target is on allowlist.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">isFunctionAllowed(account, target, selector)</td><td className="py-2 pr-4">View</td><td className="py-2 text-muted">Check if function is allowed on target.</td></tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-lg font-semibold mb-3">Events</h3>
      <CodeBlock language="solidity">{`event SpendLimitSet(address indexed account, address indexed token, uint256 maxPerDay);
event TargetAllowlistUpdated(address indexed account, address indexed target, bool allowed);
event FunctionAllowlistUpdated(address indexed account, address indexed target, bytes4 selector, bool allowed);
event SpendRecorded(address indexed account, address indexed token, uint256 amount, uint256 dailyTotal);`}</CodeBlock>

      <h3 className="text-lg font-semibold mb-3 mt-6">Errors</h3>
      <CodeBlock language="solidity">{`error Unauthorized();
error TargetNotAllowed(address target);
error FunctionNotAllowed(address target, bytes4 selector);
error DailySpendLimitExceeded(address token, uint256 attempted, uint256 remaining);
error DelegateCallNotAllowed();`}</CodeBlock>

      <h3 className="text-lg font-semibold mb-3 mt-6">Spend Limit Mechanics</h3>
      <ul className="list-disc list-inside space-y-2 text-sm text-muted mb-6">
        <li>24-hour rolling window based on <code>lastResetTimestamp</code></li>
        <li>Window resets when <code>block.timestamp &gt;= lastResetTimestamp + 1 day</code></li>
        <li><code>maxPerDay = 0</code> means no limit configured (allows freely)</li>
        <li>Limits are per-account, per-token</li>
        <li><code>address(0)</code> represents native ETH</li>
      </ul>

      <hr className="border-border my-10" />

      {/* PolicyAccount */}
      <h2 className="text-2xl font-semibold mb-4" id="policy-account">PolicyAccount (ERC-4337)</h2>
      <p className="text-sm text-muted mb-6">Smart account that delegates policy validation to PolicyModule.</p>

      <h3 className="text-lg font-semibold mb-3">Functions</h3>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-muted"><th className="pb-3 pr-4">Function</th><th className="pb-3 pr-4">Access</th><th className="pb-3">Description</th></tr></thead>
          <tbody className="divide-y divide-border">
            <tr><td className="py-2 pr-4 font-mono text-xs">execute(target, value, data)</td><td className="py-2 pr-4">EntryPoint or self</td><td className="py-2 text-muted">Execute a call after policy check.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">validateUserOp(userOp, userOpHash, missingAccountFunds)</td><td className="py-2 pr-4">EntryPoint</td><td className="py-2 text-muted">Validate ERC-4337 UserOp signature.</td></tr>
          </tbody>
        </table>
      </div>

      <p className="text-sm text-muted">
        The account checks <code>PolicyModule.checkTransaction()</code> before executing any call
        and records ETH spend via <code>PolicyModule.recordSpend()</code>.
      </p>
    </div>
  );
}
