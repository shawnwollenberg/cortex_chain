# Settlement Plans

Cortex quote commitments can bind a payment to a canonical settlement plan. The plan is JSON that describes who gets paid, how much each party gets, which wallet receives tax or tip reserves, and which terms the agent accepted.

The current Base Sepolia contracts do not split funds themselves. Instead, the merchant quote response includes a `cortex.settlement-plan.v1` document, and `CommerceRegistry.commitQuote` binds `termsHash` to `keccak256(utf8(settlementPlanJson))`. Agents verify that hash before paying, then receipts and fulfillment evidence can reference the resulting payment execution.

## Why This Matters

Agentic commerce will not always be one buyer paying one merchant. A single quote may need to cover:

- A primary merchant.
- One or more partner merchants or suppliers.
- Sales tax, VAT, or other reserve lines.
- Optional tips.
- Platform, facilitator, protocol, escrow, or fulfillment fees.

Putting those terms into the quote gives agents a deterministic thing to verify before payment and gives merchants a shared reconciliation record after settlement.

## Canonical Shape

```json
{
  "schema": "cortex.settlement-plan.v1",
  "network": "base-sepolia",
  "registry": "0xf0bf44b28567f0b3d2370dc7af8a63335746d8d4",
  "quote": {
    "merchant_id": "1",
    "service_numeric_id": "1",
    "service_id": "enrich-company-v1",
    "agent": "0x...",
    "token": "0x...",
    "payment_rail": "transfer",
    "facilitator": "0x0000000000000000000000000000000000000000",
    "gross_amount": "1000000"
  },
  "terms": {
    "summary": "One company enrichment response for the requested domain.",
    "terms_uri": "https://merchant.example/terms",
    "refund_policy": "Refunds available when fulfillment does not match accepted quote terms.",
    "dispute_window_seconds": 86400
  },
  "lines": [
    {
      "kind": "merchant",
      "label": "Primary merchant",
      "merchant_id": "1",
      "recipient": "0x...",
      "token": "0x...",
      "amount": "850000",
      "basis_points": 8500
    },
    {
      "kind": "supplier",
      "label": "Partner merchant",
      "merchant_id": null,
      "recipient": "0x...",
      "token": "0x...",
      "amount": "100000",
      "basis_points": 1000
    },
    {
      "kind": "tax",
      "label": "Tax reserve",
      "jurisdiction": "state-or-county",
      "authority": "merchant_or_tax_provider",
      "recipient": "0x...",
      "token": "0x...",
      "amount": "40000",
      "basis_points": 400
    },
    {
      "kind": "tip",
      "label": "Optional tip",
      "optional": true,
      "recipient": "0x...",
      "token": "0x...",
      "amount": "10000",
      "basis_points": 100
    }
  ],
  "verification": {
    "line_total": "1000000",
    "matches_quote_amount": true,
    "hash_algorithm": "keccak256(utf8(canonical_settlement_plan_json))"
  }
}
```

## Line Kinds

Supported line kinds should stay explicit:

- `merchant`: The primary merchant payout.
- `supplier`: A partner merchant, manufacturer, service provider, or affiliate.
- `tax`: A tax reserve or remittance wallet.
- `tip`: Optional tip or gratuity.
- `platform_fee`: Marketplace or SaaS platform fee.
- `facilitator_fee`: Payment facilitator fee.
- `protocol_fee`: Future Cortex protocol fee if one is enabled.
- `escrow`: Funds held until fulfillment, delivery, or dispute resolution.

Tax wallets need special care. Cortex should not assume that an IRS, state, county, or city wallet exists. Today, a tax line should point to a merchant-controlled reserve wallet, a verified tax provider, or a verified government wallet only when that wallet has been independently validated.

## Agent Validation

Before paying, an agent should:

1. Fetch the merchant quote response.
2. Extract `settlement_plan`.
3. Recompute the plan hash over the exact canonical JSON bytes.
4. Confirm that hash equals the quote `termsHash`.
5. Confirm `line_total` equals `quote.amount`.
6. Confirm every recipient is acceptable under account policy.
7. Confirm tax, tip, partner, and fee lines match the agent's request and user preferences.
8. Confirm `x402PayloadHash` if the payment rail is x402.
9. Pay through the selected rail only after all checks pass.

## Settlement Execution

The first implementation treats settlement plans as quote-bound instructions. Actual payment movement can happen through:

- Direct native or ERC-20 transfer.
- Swap then transfer.
- Facilitator-mediated settlement.
- x402 payment acceptance.
- Merchant-side split payout after receipt.
- A future split/escrow settlement adapter.

Receipts should record the quote hash and result hash after settlement. Fulfillment evidence can then prove that the merchant delivered against the same quote and settlement plan the agent accepted.

## Future Hardening

The next deeper architecture step is an optional onchain settlement adapter that can execute split payouts, escrow, refunds, and dispute-aware releases. That should be added after the quote-bound plan format has stabilized through real merchant and agent tests.
