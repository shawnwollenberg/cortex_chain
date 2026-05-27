# Settlement Adapter Design

Cortex binds settlement instructions into `termsHash` and lets payment happen through direct transfers, swaps, facilitators, x402, or a settlement adapter. The first concrete adapter executes direct native-token or ERC-20 split payouts for a quote-bound settlement plan.

## Contract

`contracts/src/SettlementAdapter.sol` implements `ISettlementAdapter.executeSettlement`.

It turns a verified `cortex.settlement-plan.v1` document into deterministic payment execution without putting private fulfillment data onchain.

Base Sepolia deployment: `0xbD61097Cc7b7E1F03E88Fe20E9512ff091126cb3`.

The adapter should:

- Accept a `quoteHash` and `settlementPlanHash`.
- Accept deterministic line data derived from the canonical settlement plan.
- Verify the sum of executable line amounts equals `grossAmount`.
- Transfer native ETH or ERC-20 funds to recipients for line kinds such as merchant, supplier, tax, tip, shipping, handling, platform fee, facilitator fee, protocol fee, and escrow.
- Emit a single `SettlementExecuted` event with an `executionHash`.
- Leave encrypted fulfillment payloads offchain and reference only hashes.

## First Interface

The repo includes `contracts/src/interfaces/ISettlementAdapter.sol` as the target interface:

```solidity
function executeSettlement(SettlementInstruction calldata instruction)
    external
    payable
    returns (bytes32 executionHash);
```

The adapter does not parse JSON. Agents and merchants verify the canonical settlement plan offchain, then pass deterministic line data into the adapter.

## Direct Split Adapter

The first concrete adapter supports:

- Native token split when `token == address(0)`.
- ERC-20 split when `token != address(0)`.
- One token per execution.
- No swaps inside the adapter.
- No facilitator or x402 settlement inside the adapter.
- Optional escrow line that pays an escrow contract instead of the merchant.

For ERC-20, the payer approves the adapter for `grossAmount`, then calls `executeSettlement`. For native token, `msg.value` must equal `grossAmount`.

## Validation Rules

The adapter should revert when:

- The quote hash is zero.
- The settlement plan hash is zero.
- The payer is zero or not the caller unless delegated execution is explicitly supported.
- The deadline has passed.
- A recipient is zero for a non-escrow payable line.
- A line token does not match the instruction token.
- Line totals do not equal `grossAmount`.
- `msg.value` does not match native-token settlement.
- ERC-20 transfer or transferFrom fails.

## Event and Receipt Linkage

`SettlementExecuted` should include:

- `quoteHash`
- `settlementPlanHash`
- `payer`
- `token`
- `grossAmount`
- `executionHash`

The merchant, agent, or facilitator can use `executionHash` as the `resultHash` when recording the Cortex receipt. Fulfillment evidence can later bind shipment tracking hashes, encrypted payload hashes, delivery proof hashes, or refund/dispute records.

## Not In Version One

The first adapter should not attempt:

- DEX routing.
- Cross-token line settlement.
- Tax calculation.
- Address decryption.
- x402 facilitator reconciliation.
- Refund arbitration.

Those belong in later adapters or offchain coordinators once the direct split path is proven.
