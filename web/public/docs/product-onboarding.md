# Cortex Product Onboarding

The hosted onboarding workspace helps merchants, agent operators, and developers prepare the data needed to test Cortex on Base Sepolia.

Open:

- Hosted: `https://cortex.wallyweb.com/onboarding`
- Local: `http://localhost:3000/onboarding`

The page does not request private keys, connect a wallet, or submit transactions. It generates metadata JSON, registration command templates, policy setup templates, and quote acceptance checklists that can be copied into a local wallet/script workflow.

## Current Onboarding Steps

1. **Merchant profile**
   - Build merchant metadata.
   - Set payout address, support contact, website, refund policy, metadata URI, and metadata hash.
   - Generate a `registerMerchant` command for `CommerceRegistry`.

2. **Service catalog**
   - Build service metadata.
   - Set service id, capability description, input/output schemas, payment rails, metadata URI, metadata hash, and capability hash.
   - Generate a `registerService` command.

3. **Agent policy**
   - Build agent metadata.
   - Register an agent identity through `AgentRegistry`.
   - Generate a signed payment policy command for facilitator-mediated or x402-style payments.

4. **Quote acceptance**
   - Build a quote payload.
   - Generate a viem template for `computeQuoteHash` and `commitQuote`.
   - Show the agent-side acceptance checklist for merchant/service state, metadata hashes, rail/facilitator matching, account policy, x402 payload hash, expiry, and nonce.

## Product Constraints

- Hashes must be computed by the user's wallet/script environment before registration. The browser page intentionally does not guess at canonical hashing for all payloads.
- The page is safe for public hosting because it never handles private keys.
- Rich metadata stays offchain; Cortex anchors the URI and hash onchain.
- x402 is supported as a payment rail, but the flow also supports direct transfers, swaps, and facilitator-mediated payments.

## Next Product Improvements

- Add wallet connection and read-only chain checks.
- Add metadata hash calculation with the exact canonical hash rules we standardize on.
- Add service catalog hosting or publishing workflow.
- Add quote request/response API flow instead of only quote templates.
- Add SDK examples for transfer, swap, facilitator, and x402 payments.
- Add guided post-transaction verification against the hosted API.

