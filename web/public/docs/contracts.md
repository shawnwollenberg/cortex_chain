# Contracts Reference

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
| `setGuardian(guardian)` | Account | Configure a guardian that can freeze/unfreeze the account. |
| `setAccountFrozen(account, frozen)` | Account or guardian | Freeze/unfreeze account execution. |
| `checkTransaction(target, value, data)` | View | Validate a transaction against all policies. |
| `recordSpend(token, amount)` | Account | Record spending against daily limit. |
| `getTokenSpend(target, data)` | Pure | Detect ERC-20 `transfer`, `approve`, and `transferFrom` spend from calldata. |
| `getSpendLimit(account, token)` | View | Get spend limit config. |
| `getSpentToday(account, token)` | View | Get amount spent in current 24h window. |
| `isTargetAllowed(account, target)` | View | Check if target is on allowlist. |
| `isFunctionAllowed(account, target, selector)` | View | Check if function is allowed on target. |
| `guardianOf(account)` | View | Get the configured guardian. |
| `isAccountFrozen(account)` | View | Check whether account execution is frozen. |
| `setSignedPaymentPolicy(merchant, token, facilitator, maxPerPayment, maxPerDay, allowed)` | Account | Configure facilitator/x402-style delegated payment budgets. |
| `recordSignedPayment(merchant, token, facilitator, amount, paymentHash)` | Account | Record a signed payment against policy and replay protection. |

### Events

```solidity
event SpendLimitSet(address indexed account, address indexed token, uint256 maxPerDay);
event TargetAllowlistUpdated(address indexed account, address indexed target, bool allowed);
event FunctionAllowlistUpdated(address indexed account, address indexed target, bytes4 selector, bool allowed);
event FunctionAllowlistModeUpdated(address indexed account, bool enabled);
event SpendRecorded(address indexed account, address indexed token, uint256 amount, uint256 dailyTotal);
event GuardianSet(address indexed account, address indexed guardian);
event AccountFrozen(address indexed account, bool frozen);
event SignedPaymentPolicySet(address indexed account, address indexed merchant, address indexed token, address facilitator, uint256 maxPerPayment, uint256 maxPerDay, bool allowed);
event SignedPaymentRecorded(address indexed account, address indexed merchant, address indexed token, address facilitator, uint256 amount, bytes32 paymentHash, uint256 dailyTotal);
```

### Errors

```solidity
error Unauthorized();
error AccountFrozenError(address account);
error TargetNotAllowed(address target);
error FunctionNotAllowed(address target, bytes4 selector);
error DailySpendLimitExceeded(address token, uint256 attempted, uint256 remaining);
error DelegateCallNotAllowed();
error PaymentNotAllowed(address merchant, address token, address facilitator);
error PaymentLimitExceeded(address token, uint256 attempted, uint256 maxPerPayment);
error PaymentAlreadyRecorded(bytes32 paymentHash);
```

### Spend Limit Mechanics

- 24-hour rolling window based on `lastResetTimestamp`
- Window resets when `block.timestamp >= lastResetTimestamp + 1 day`
- `maxPerDay = 0` means no limit configured (allows freely)
- Limits are per-account, per-token
- `address(0)` represents native ETH
- ERC-20 `transfer`, `approve`, and `transferFrom` amounts are detected from calldata and charged against the token target's spend limit.
- Signed payment policies support facilitator-mediated and x402-style payments where the account signs an authorization that may settle later.
- Basic wallet-to-wallet transfers and swaps are handled through normal target/function allowlists plus spend limits.

---

## PolicyAccount (ERC-4337)

Smart account that delegates policy validation to PolicyModule.

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `execute(target, value, data)` | EntryPoint or self | Execute a call after policy check. |
| `executeWithSessionKey(target, value, data, deadline, nonce, signature)` | Anyone with session-key signature | Execute through an active, unexpired session key. Still enforces account policy. |
| `validateUserOp(userOp, userOpHash, missingAccountFunds)` | EntryPoint only | Validate ERC-4337 UserOp signature. |
| `setSessionKey(sessionKey, expiresAt, active)` | EntryPoint or self | Add, update, or revoke a scoped session key. |
| `setGuardian(guardian)` | EntryPoint or self | Configure account guardian. |
| `setAccountFrozen(frozen)` | EntryPoint or self | Freeze/unfreeze this account. |

The account checks `PolicyModule.checkTransaction()` before executing any call and records native ETH plus detected ERC-20 spend via `PolicyModule.recordSpend()`.

Session-key execution signs `address(this)`, `chainId`, target, value, calldata hash, deadline, and nonce. Nonces are tracked per session key to prevent replay, and policies are still enforced before the call.

---

## SolverRegistry

Permissionless registry for solver operators.

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `registerSolver(metadataURI, capabilitiesHash)` | Anyone | Register a solver. Accepts optional ETH bond. |
| `updateSolver(solverId, metadataURI, capabilitiesHash, active)` | Operator only | Update metadata/capabilities and active status. |
| `addBond(solverId)` | Operator only | Add ETH bond. |
| `withdrawBond(solverId, amount)` | Operator only, inactive | Withdraw bond after deactivation. |
| `getSolver(solverId)` | View | Get solver record. |
| `getSolverByOperator(operator)` | View | Resolve operator to solver ID. |

### Events

```solidity
event SolverRegistered(uint256 indexed solverId, address indexed operator, string metadataURI, bytes32 capabilitiesHash, uint256 bond);
event SolverUpdated(uint256 indexed solverId, string metadataURI, bytes32 capabilitiesHash, bool active);
event SolverBondChanged(uint256 indexed solverId, uint256 bond);
```

---

## AttestorRegistry

Permissionless registry for attestors and supported schema metadata.

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `registerAttestor(metadataURI, schemasHash)` | Anyone | Register an attestor operator. |
| `updateAttestor(attestorId, metadataURI, schemasHash, active)` | Operator only | Update metadata/schemas and active status. |
| `getAttestor(attestorId)` | View | Get attestor record. |
| `getAttestorByOperator(operator)` | View | Resolve operator to attestor ID. |

### Events

```solidity
event AttestorRegistered(uint256 indexed attestorId, address indexed operator, string metadataURI, bytes32 schemasHash);
event AttestorUpdated(uint256 indexed attestorId, string metadataURI, bytes32 schemasHash, bool active);
```

---

## CommerceRegistry

Registers merchants, services, payment facilitators, quote commitments, receipts, and disputes for agentic commerce.

### Quote Commitment

```solidity
struct QuoteCommitment {
    uint256 merchantId;
    uint256 serviceNumericId;
    address agent;
    address token;
    address facilitator;
    uint256 amount;
    uint256 expiresAt;
    uint256 paymentNonce;
    bytes32 resourceHash;
    bytes32 termsHash;
    bytes32 x402PayloadHash;
}
```

`x402PayloadHash` is used for x402 payments. Other payment rails can bind transfer, swap, or facilitator details through the quote's terms and resource hashes while still using normal account policies.

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `registerMerchant(payoutAddress, metadataURI, metadataHash)` | Anyone | Register a merchant owner and payout address. |
| `updateMerchant(merchantId, payoutAddress, metadataURI, metadataHash, active)` | Merchant owner | Update merchant metadata and active status. |
| `registerService(merchantId, serviceId, metadataURI, metadataHash, capabilityHash)` | Merchant owner | Register a machine-readable service. |
| `updateService(serviceNumericId, metadataURI, metadataHash, capabilityHash, active)` | Merchant owner | Update service metadata/capabilities and active status. |
| `registerFacilitator(facilitator, metadataURI, metadataHash)` | Anyone | Register or refresh a facilitator address. |
| `updateFacilitator(facilitatorId, metadataURI, metadataHash, active)` | Facilitator address | Update facilitator metadata and active status. |
| `commitQuote(commitment)` | Merchant owner | Commit a canonical quote hash. Requires active facilitator. |
| `recordReceipt(quoteHash, resultHash)` | Quote facilitator | Mark quote settled and emit receipt. |
| `openDispute(receiptId, reasonHash)` | Agent, merchant, or facilitator | Open a receipt-linked dispute. |
| `resolveDispute(disputeId, status, resolutionHash)` | Merchant or facilitator | Resolve or reject an open dispute. |
| `computeQuoteHash(...)` | View | Compute the canonical quote hash. |
| `PROTOCOL_FEE_BPS()` | View | Current protocol fee bps. Currently `0`. |

### Events

```solidity
event MerchantRegistered(uint256 indexed merchantId, address indexed owner, address indexed payoutAddress, string metadataURI, bytes32 metadataHash);
event ServiceRegistered(uint256 indexed serviceNumericId, uint256 indexed merchantId, string serviceId, string metadataURI, bytes32 metadataHash, bytes32 capabilityHash);
event FacilitatorRegistered(uint256 indexed facilitatorId, address indexed facilitator, string metadataURI, bytes32 metadataHash);
event QuoteCommitted(bytes32 indexed quoteHash, uint256 indexed merchantId, uint256 indexed serviceNumericId, address agent, address token, address facilitator, uint256 amount, uint16 protocolFeeBps, uint256 protocolFeeAmount, uint256 expiresAt, uint256 paymentNonce, bytes32 resourceHash, bytes32 termsHash, bytes32 x402PayloadHash);
event ReceiptRecorded(uint256 indexed receiptId, bytes32 indexed quoteHash, address indexed agent, uint256 merchantId, uint256 serviceNumericId, address token, uint256 amount, uint16 protocolFeeBps, uint256 protocolFeeAmount, address facilitator, bytes32 resultHash, bytes32 resourceHash);
event DisputeOpened(uint256 indexed disputeId, uint256 indexed receiptId, address indexed opener, bytes32 reasonHash);
event DisputeResolved(uint256 indexed disputeId, DisputeStatus status, bytes32 resolutionHash);
```

Quote hashes bind chain ID, registry address, service terms, payment terms, and zero-fee protocol terms. Protocol fee fields are emitted and indexed for analytics but currently remain zero.
