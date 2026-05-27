# Settlement Plans

Cortex quote commitments can bind a payment to a canonical settlement plan. The plan is JSON that describes who gets paid, how much each party gets, which wallet receives tax or tip reserves, and which terms the agent accepted.

The current Base Sepolia contracts do not split funds themselves. Instead, the merchant quote response includes a `cortex.settlement-plan.v1` document, and `CommerceRegistry.commitQuote` binds `termsHash` to `keccak256(utf8(settlementPlanJson))`. Agents verify that hash before paying, then receipts and fulfillment evidence can reference the resulting payment execution.

## Why This Matters

Agentic commerce will not always be one buyer paying one merchant. A single quote may need to cover:

- A primary merchant.
- One or more partner merchants or suppliers.
- Sales tax, VAT, or other reserve lines.
- Optional tips.
- Shipping and handling for physical goods.
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
  "fulfillment": {
    "encrypted_payload_uri": "https://api.cortex.wallyweb.com/fulfillment/0x...",
    "encrypted_payload_hash": "0x...",
    "encryption": "x25519-xsalsa20-poly1305",
    "merchant_key_id": "did:key:z6MkMerchantFulfillmentKey",
    "contains": ["shipping_name", "shipping_address", "delivery_instructions"],
    "plaintext_not_onchain": true
  },
  "lines": [
    {
      "kind": "merchant",
      "label": "Primary merchant",
      "merchant_id": "1",
      "recipient": "0x...",
      "token": "0x...",
      "amount": "830000",
      "basis_points": 8300
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
    },
    {
      "kind": "shipping",
      "label": "Ground shipping",
      "method": "merchant-selected ground",
      "recipient": "0x...",
      "token": "0x...",
      "amount": "15000",
      "basis_points": 150,
      "fulfillment_hash": "0x..."
    },
    {
      "kind": "handling",
      "label": "Handling",
      "recipient": "0x...",
      "token": "0x...",
      "amount": "5000",
      "basis_points": 50
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
- `shipping`: Shipping, postage, freight, or carrier cost.
- `handling`: Packaging, pick/pack, warehouse, or fulfillment labor cost.
- `platform_fee`: Marketplace or SaaS platform fee.
- `facilitator_fee`: Payment facilitator fee.
- `protocol_fee`: Future Cortex protocol fee if one is enabled.
- `escrow`: Funds held until fulfillment, delivery, or dispute resolution.

Tax wallets need special care. Cortex should not assume that an IRS, state, county, or city wallet exists. Today, a tax line should point to a merchant-controlled reserve wallet, a verified tax provider, or a verified government wallet only when that wallet has been independently validated.

## Shipping Addresses

Shipping addresses should not be written onchain or placed in public quote metadata. Physical-goods quotes should use an encrypted fulfillment payload:

1. The merchant publishes a fulfillment encryption key in merchant metadata.
2. The agent encrypts the buyer's shipping name, address, contact fields, and delivery instructions to that merchant key.
3. The encrypted payload is stored offchain at a stable URI.
4. The settlement plan includes only the encrypted payload URI, payload hash, encryption scheme, and merchant key id.
5. The merchant decrypts the payload privately and ships the item.

The public Cortex trail should include costs, commitments, hashes, carrier promises, tracking hashes, receipts, and fulfillment proof hashes. It should not include plaintext names, street addresses, phone numbers, or delivery notes.

## Agent Validation

Before paying, an agent should:

1. Fetch the merchant quote response.
2. Extract `settlement_plan`.
3. Recompute the plan hash over the exact canonical JSON bytes.
4. Confirm that hash equals the quote `termsHash`.
5. Confirm `line_total` equals `quote.amount`.
6. Confirm every recipient is acceptable under account policy.
7. Confirm tax, tip, partner, and fee lines match the agent's request and user preferences.
8. Confirm shipping and handling costs match the buyer's selected delivery option.
9. Confirm encrypted fulfillment payload hash and merchant key id match what the buyer approved.
10. Confirm `x402PayloadHash` if the payment rail is x402.
11. Pay through the selected rail only after all checks pass.

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
