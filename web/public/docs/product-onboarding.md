# Cortex Product Onboarding

The hosted onboarding workspace helps merchants, agent operators, and developers prepare the data needed to test Cortex on Base Sepolia.

Open:

- Hosted: `https://cortex.wallyweb.com/onboarding`
- Local: `http://localhost:3000/onboarding`

The page does not request private keys, signatures, or transaction submission. It can connect to an injected wallet for read-only checks and Base Sepolia network switching, then generates metadata JSON, registration command templates, policy setup templates, and quote acceptance checklists that can be copied into a local wallet/script workflow.

Generated JSON document hashes use canonical JSON plus `keccak256` through `viem`, matching the hosted API convention for catalogs, quote requests, quote responses, settlement plans, and fulfillment payload envelopes.

The read-only preflight panel can connect to an injected wallet to check the selected account, chain ID, deployed contract bytecode, and hosted API health. It can also ask the wallet to switch or add Base Sepolia. It does not request signatures or submit transactions.

## Current Onboarding Steps

0. **Read-only preflight**
   - Connect an injected wallet.
   - Confirm the wallet is on Base Sepolia (`84532`).
   - Switch or add Base Sepolia from the wallet if needed.
   - Check deployed bytecode for AgentRegistry, PolicyModule, and CommerceRegistry.
   - Check hosted API health.
   - Copy the connected wallet address into merchant owner, agent owner, and quote agent fields.

1. **Merchant profile**
   - Build merchant metadata.
   - Set payout address, support contact, website, refund policy, metadata URI, and metadata hash.
   - Generate the merchant metadata hash from the displayed JSON.
   - Generate a `registerMerchant` command for `CommerceRegistry`.
   - Check the hosted API for the indexed merchant record.
   - Read the merchant record directly from `CommerceRegistry.getMerchant`.

2. **Service catalog**
   - Build service metadata inputs.
   - Set service id, endpoint, method, description, capability, input/output schemas, metadata URI, metadata hash, and capability hash.
   - Generate a `registerService` command.
   - Check the hosted API for indexed active services.
   - Read the service record directly from `CommerceRegistry.getService`.

3. **Publish catalog**
   - Generate a schema-compatible merchant/service catalog JSON document.
   - Include service endpoint, method, payment rail, token, amount, facilitator, schemas, SLA, refund, and privacy metadata.
   - Generate a canonical catalog hash with `keccak256`.
   - Download the JSON file to publish to IPFS, Arweave, S3, or HTTPS.
   - Or publish the JSON to the hosted Cortex API, which canonicalizes it, stores it by `keccak256` hash, and returns `https://api.cortex.wallyweb.com/catalogs/:hash`.
   - Use the catalog URI and hash as the service metadata URI/hash for `registerService`.

4. **Agent policy**
   - Build agent metadata.
   - Register an agent identity through `AgentRegistry`.
   - Generate an agent capabilities hash.
   - Generate a signed payment policy command for facilitator-mediated or x402-style payments.
   - Read agent ids owned by the connected wallet from `AgentRegistry.getAgentsByOwner`.

5. **Quote acceptance**
   - Build an agent quote request JSON document.
   - Build a merchant quote response JSON document.
   - Build a quote-bound settlement plan for multi-merchant, tax, tip, and fee lines.
   - Add shipping and handling lines for physical goods when needed.
   - Bind an encrypted fulfillment payload URI/hash for shipping addresses and delivery instructions.
   - Publish the quote request and quote response to the hosted Cortex API for URL-based agent/merchant handoff.
   - Build the onchain quote payload.
   - Generate resource, settlement-plan terms, and x402 payload hashes from their source documents.
   - Generate a viem template for `computeQuoteHash` and `commitQuote`.
   - Download quote request and response JSON files for local testing.
   - Show the agent-side acceptance checklist for merchant/service state, metadata hashes, settlement totals, tax recipients, encrypted fulfillment payloads, rail/facilitator matching, account policy, x402 payload hash, expiry, and nonce.
   - Check indexed merchant reputation before accepting a quote.

## Product Constraints

- JSON hashes are generated from canonicalized document bytes. If a merchant later publishes different canonical bytes at the same URI, agents should reject the mismatch.
- The page is safe for public hosting because it never handles private keys.
- Rich metadata stays offchain; Cortex anchors the URI and hash onchain.
- Catalog JSON follows `docs/service-catalog.schema.json` closely enough for onboarding and examples. Production catalogs should be validated against that schema in CI or publishing tooling.
- x402 is supported as a payment rail, but the flow also supports direct transfers, swaps, and facilitator-mediated payments.

## Next Product Improvements

- Use the onboarding page to generate or paste a merchant fulfillment public key, encrypt shipping details in the browser, publish the canonical ciphertext envelope, and bind its hash into the settlement plan.
- Publish canonical fulfillment evidence documents after settlement, then call `recordFulfillment(receiptId, evidenceHash)` so receipts point at a retrievable evidence record.
- Expand SDK examples into runnable sample scripts for transfer, swap, facilitator, and x402 payments.
- Add guided post-transaction verification against the hosted API.
