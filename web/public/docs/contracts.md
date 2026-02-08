# Contracts Reference

Four core contracts make up the onchain layer: AgentRegistry, IntentBook, PolicyModule, and PolicyAccount.

---

## AgentRegistry

Stores agent identity records. Agents are registered by their owner address.

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `registerAgent(metadataURI, pubkey, capabilitiesHash)` | Anyone | Register a new agent. Returns `agentId`. |
| `updateAgent(agentId, metadataURI, capabilitiesHash)` | Owner only | Update agent metadata. Reverts if revoked. |
| `revokeAgent(agentId)` | Owner only | Permanently revoke an agent. |
| `getAgent(agentId)` | View | Get agent record. Reverts if not found. |
| `getAgentsByOwner(owner)` | View | Get all agent IDs for an owner. |

### Events

```solidity
event AgentRegistered(uint256 indexed agentId, address indexed owner, string metadataURI);
event AgentUpdated(uint256 indexed agentId, string metadataURI, bytes32 capabilitiesHash);
event AgentRevoked(uint256 indexed agentId);
```

### Errors

```solidity
error Unauthorized();
error AgentNotFound();
error AgentAlreadyRevoked();
```

---

## IntentBook

Manages the intent lifecycle: submit, fill, cancel. Uses EIP-712 signed typed data.

### EIP-712 Domain

```
name: "AgentIntentBook"
version: "1"
chainId: <chain ID>
verifyingContract: <IntentBook address>
```

### Intent Struct

```solidity
struct Intent {
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
}
```

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `submitIntent(intent, v, r, s)` | Anyone | Submit a signed intent. Validates signature, nonce, deadline, slippage. |
| `cancelIntent(intentId)` | Owner only | Cancel an open intent. |
| `fillIntent(intentId, fill)` | Anyone (solver) | Fill an open intent. Validates constraints and expiry. |
| `getIntent(intentId)` | View | Get intent data. |
| `getIntentStatus(intentId)` | View | Get intent status (OPEN, FILLED, CANCELLED, EXPIRED). |

### Events

```solidity
event IntentSubmitted(uint256 indexed intentId, address indexed owner, uint256 nonce);
event IntentCancelled(uint256 indexed intentId);
event IntentFilled(uint256 indexed intentId, address indexed solver, uint256 amountIn, uint256 amountOut);
```

### Errors

```solidity
error Unauthorized();
error InvalidNonce();
error IntentExpired();
error IntentNotOpen();
error ConstraintViolation();
error InvalidSlippage();     // slippageBps > 10,000
error InvalidDeadline();     // deadline <= block.timestamp
error InvalidSignature();    // recovered signer != intent.owner
```

---

## PolicyModule

Enforces per-account policies: spend limits, target allowlists, function selector allowlists.

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `setSpendLimit(token, maxPerDay)` | Account (msg.sender) | Set daily spend limit for a token. 0 removes the limit. |
| `setTargetAllowed(target, allowed)` | Account | Add/remove target from allowlist. |
| `setFunctionAllowed(target, selector, allowed)` | Account | Allow/disallow a function selector on a target. |
| `setUseFunctionAllowlist(enabled)` | Account | Enable/disable function-level checks. |
| `checkTransaction(target, value, data)` | View | Validate a transaction against all policies. |
| `recordSpend(token, amount)` | Account | Record spending against daily limit. |
| `getSpendLimit(account, token)` | View | Get spend limit config. |
| `getSpentToday(account, token)` | View | Get amount spent in current 24h window. |
| `isTargetAllowed(account, target)` | View | Check if target is on allowlist. |
| `isFunctionAllowed(account, target, selector)` | View | Check if function is allowed on target. |

### Events

```solidity
event SpendLimitSet(address indexed account, address indexed token, uint256 maxPerDay);
event TargetAllowlistUpdated(address indexed account, address indexed target, bool allowed);
event FunctionAllowlistUpdated(address indexed account, address indexed target, bytes4 selector, bool allowed);
event SpendRecorded(address indexed account, address indexed token, uint256 amount, uint256 dailyTotal);
```

### Errors

```solidity
error Unauthorized();
error TargetNotAllowed(address target);
error FunctionNotAllowed(address target, bytes4 selector);
error DailySpendLimitExceeded(address token, uint256 attempted, uint256 remaining);
error DelegateCallNotAllowed();
```

### Spend Limit Mechanics

- 24-hour rolling window based on `lastResetTimestamp`
- Window resets when `block.timestamp >= lastResetTimestamp + 1 day`
- `maxPerDay = 0` means no limit configured (allows freely)
- Limits are per-account, per-token
- `address(0)` represents native ETH

---

## PolicyAccount (ERC-4337)

Smart account that delegates policy validation to PolicyModule.

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `execute(target, value, data)` | EntryPoint or self | Execute a call after policy check. |
| `validateUserOp(userOp, userOpHash, missingAccountFunds)` | EntryPoint only | Validate ERC-4337 UserOp signature. |

The account checks `PolicyModule.checkTransaction()` before executing any call and records ETH spend via `PolicyModule.recordSpend()`.
