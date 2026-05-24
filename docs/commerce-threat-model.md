# Commerce Threat Model

## Primary Risks

- Fake merchants or cloned services: agents may pay a lookalike service.
- Malicious or compromised facilitators: a facilitator may settle an unexpected payment or fail to settle.
- Quote replay: a valid quote may be reused across chains, registries, resources, or payment payloads.
- Payment payload substitution: an agent may approve one transfer, swap, facilitator, or x402 payment requirement while the merchant records another.
- Stale metadata: a merchant may update service behavior without agents noticing.
- Refund abuse: agents may repeatedly consume services and open weak disputes.
- Merchant non-fulfillment: merchants may accept payment and return invalid, late, or malformed results.
- Compromised session keys: a delegated key may overspend or call unapproved targets.
- Privacy leakage: prompts, URLs, payloads, or business intent may leak through metadata or payment requirements.

## Current Mitigations

- Merchant, service, and facilitator identities are anchored onchain.
- Rich service metadata remains offchain but is hash-committed onchain.
- Quote hashes are canonical and bind chain id, registry address, agent, merchant, service, token, facilitator/payment rail, amount, expiry, nonce, resource hash, terms hash, optional x402 payload hash, and zero-fee protocol terms.
- Signed payment policies restrict merchant, token, facilitator, per-payment amount, and daily budget.
- Signed payment recording rejects duplicate payment hashes.
- Receipts and disputes create a public reputation trail for both merchant non-fulfillment and agent refund abuse.
- Intent execution metadata, fill proofs, and selected bid execution hashes are committed/indexed.

## Remaining Work Before Public Mainnet Use

- Add real x402 payload parser/normalizer for the exact EIP-3009 and Permit2 authorization shapes used by the chosen facilitator.
- Add merchant/service attestation requirements for verified domains, ownership, uptime, and schema compliance.
- Add dispute roles beyond merchant/facilitator self-resolution, such as attestor or arbitrator resolution.
- Add privacy guidance and redaction tooling for service catalogs and payment requirements.
- Add merchant/agent reputation scoring over receipts and disputes.
