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

## Next Implementation Detail

Before Base Sepolia, add a small x402 normalizer utility that converts facilitator payment requirements into a canonical `x402PayloadHash`. It should support the actual authorization schemes we plan to demo first:

- EIP-3009 for USDC-style `transferWithAuthorization`
- Permit2 for general ERC20 payments
