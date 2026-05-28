# x402 Policy Integration

x402 payments are policy-sensitive because the account may sign an authorization that a facilitator settles later. Policy enforcement therefore must happen before the signature leaves the account, and settlement must be reconciled afterward.

## Required Pre-Sign Checks

- Merchant is registered and active.
- Service is registered, active, and belongs to the merchant.
- Service metadata hash matches the fetched service catalog.
- Facilitator is registered and active.
- Token and network are accepted by the service.
- Quote hash is canonical.
- x402 payment payload hash matches the quote.
- Payment amount is within per-payment and daily policy.
- Payment hash has not already been recorded.

## Current Contract Support

`PolicyModule.setPaymentPolicy` configures per-account signed-payment budgets by:

- merchant address
- token
- facilitator
- max per payment
- max per day
- allowed flag

`PolicyModule.recordSignedPayment` records a signed authorization hash and rejects replayed payment hashes.

`CommerceRegistry.commitQuote` binds the quote to the `x402PayloadHash`. This gives agents a stable value to compare against the payment requirement returned by an x402 server before signing.

## Normalizer and Verifier

The hosted API now exposes:

```
POST /x402/normalize
```

The normalizer accepts a payment requirement object or a container with `accepts[]`, maps common x402 field names into a Cortex canonical envelope, canonicalizes JSON key order, and returns the hash agents should compare against the quote.

Canonical envelope:

```json
{
  "schema": "cortex.x402-payment-requirement.v1",
  "scheme": "exact",
  "network": "base-sepolia",
  "pay_to": "0x...",
  "asset": "0x...",
  "amount": "1000000",
  "resource": "https://merchant.example/api/report",
  "method": "POST",
  "facilitator_url": "https://facilitator.example",
  "nonce": "quote-001"
}
```

Agent flow:

1. Fetch the merchant quote response.
2. Extract the payment requirement returned by the x402 endpoint or facilitator.
3. Call `/x402/normalize` locally or through the hosted API.
4. Compare `x402_payload_hash` with the quote's `x402PayloadHash`.
5. Run policy checks for merchant, service, token, facilitator, amount, daily budget, and replay.
6. Sign only when the hash and policy both pass.

## Remaining x402 Work

- Add scheme-specific signature verification helpers for EIP-3009 and Permit2 payloads.
- Add facilitator settlement reconciliation so a receipt can prove which facilitator actually submitted payment.
- Add production allowlists for facilitator domains and settlement addresses.
