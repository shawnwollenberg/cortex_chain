# Agentic Commerce Primitives

This project currently targets Base as a protocol layer rather than a new chain. The commerce model keeps trust anchors onchain and leaves rich discovery metadata offchain.

## Onchain Primitives

- `CommerceRegistry`
  - Merchants: owner, payout address, metadata URI/hash, active status.
  - Services: merchant-owned service id, metadata URI/hash, capability hash, active status.
  - Facilitators: facilitator address, metadata URI/hash, active status.
  - Quote commitments: canonical quote hash, merchant, service, agent, token, facilitator/payment rail, amount, zero-fee protocol terms, expiry, payment nonce, resource hash, terms hash, and optional x402 payload hash.
  - Receipts: quote settlement receipt with result/resource hashes and zero-fee monetization fields.
  - Disputes: receipt-linked reason and resolution hashes.

- `PolicyModule`
  - Transaction policies still cover target/function allowlists and token spend limits.
  - Transaction policies cover basic wallet transfers, ERC-20 transfers/approvals, swaps, and contract calls through target/function allowlists plus spend limits.
  - Signed payment policies cover facilitator-mediated and x402-style payment authorizations by merchant, token, facilitator, per-payment limit, daily budget, and payment hash replay protection.

## Quote Binding

`CommerceRegistry.computeQuoteHash` binds quote commitments to:

- `block.chainid`
- `CommerceRegistry` contract address
- merchant id
- service id
- agent address
- token
- facilitator
- amount
- expiry
- payment nonce
- resource hash
- terms hash
- optional x402 payment payload hash
- protocol fee bps and fee amount

`commitQuote` rejects non-canonical quote hashes. This prevents cross-chain, cross-registry, stale-resource, facilitator-substitution, payment-payload substitution, and fee-term substitution mistakes.

## Monetization Hooks

`CommerceRegistry` currently emits `protocolFeeBps` and `protocolFeeAmount` on quotes and receipts with `PROTOCOL_FEE_BPS = 0`. The fee terms are part of the quote hash, which gives us dashboard and API instrumentation now without charging early merchants or agents. A future fee switch should be introduced as an explicit governance/owner-controlled change, with agents continuing to verify fee terms before signing payment authorizations.

## Offchain Discovery

Merchant and service metadata should be published as JSON at `metadataURI` and verified against `metadataHash`. Directories and marketplaces can index that data for search, but agents should verify merchant, service, facilitator, quote, and payment policy state against Base before signing payment authorizations.

## Current Demo Flow

`make e2e` now exercises:

1. Agent, solver, and attestor registration.
2. Merchant, service, and facilitator registration.
3. Spend policy and x402-style signed payment policy setup.
4. Intent submission, bid selection, solver fill, and fill proof indexing.
5. Quote commitment, receipt recording, dispute opening, and dispute resolution.
6. API reads for merchants, services, facilitators, quotes, receipts, disputes, policies, intents, and bids.
