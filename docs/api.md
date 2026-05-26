# REST API Reference

Base URLs:

- Hosted Base Sepolia API: `https://api.cortex.wallyweb.com`
- Local development API: `http://localhost:3001` (configurable via `API_PORT`)

The hosted API currently indexes the live Base Sepolia deployment. Local development uses the same routes against your local Postgres/indexer stack.

## Endpoints

### Health Check

```
GET /health
```

Response:
```json
{ "status": "ok" }
```

---

### Catalog Documents

#### Publish Catalog JSON

```
POST /catalogs
```

Stores the exact catalog JSON bytes by `keccak256` hash. Use the returned `uri` and `catalog_hash` as the service metadata URI/hash when registering a service.

Request:
```json
{
  "catalog_json": "{\n  \"merchant\": {...},\n  \"services\": [...]\n}",
  "expected_hash": "0x...",
  "merchant_id": "1",
  "service_id": "enrich-company-v1"
}
```

`expected_hash`, `merchant_id`, and `service_id` are optional. If `expected_hash` is provided, the API rejects mismatches.

Response `201`:
```json
{
  "catalog_hash": "0x...",
  "merchant_id": "1",
  "service_id": "enrich-company-v1",
  "size_bytes": 2048,
  "uri": "https://api.cortex.wallyweb.com/catalogs/0x..."
}
```

#### Fetch Catalog JSON

```
GET /catalogs/:hash
```

Returns the original JSON text as `application/json`.

#### Fetch Catalog Metadata

```
GET /catalogs/:hash/metadata
```

Returns hash, merchant id, service id, byte size, timestamps, and URI.

---

### Agents

#### Get Agent by ID

```
GET /agents/:agentId
```

Response `200`:
```json
{
  "agent_id": "1",
  "owner": "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
  "metadata_uri": "ipfs://agent-meta",
  "pubkey": "0xaabb",
  "capabilities_hash": "0x...",
  "revoked": false,
  "block_number": "10"
}
```

Errors: `400` (invalid ID), `404` (not found)

#### List Agents by Owner

```
GET /agents?owner=0x...&limit=50&offset=0
```

The `owner` parameter is required.

Response `200`:
```json
{
  "agents": [...],
  "pagination": { "limit": 50, "offset": 0, "count": 1 }
}
```

Errors: `400` (missing or invalid owner)

---

### Intents

#### Get Intent by ID

```
GET /intents/:id
```

Response `200`:
```json
{
  "intent_id": "1",
  "owner": "0x...",
  "intent_type": "SWAP_EXACT_IN_MAX_SLIPPAGE",
  "input_token": "0x...",
  "output_token": "0x...",
  "amount_in_max": "1000000000000000000000",
  "amount_out_min": "900000000000000000000",
  "deadline": "1738965600",
  "slippage_bps": "100",
  "nonce": "42",
  "status": "FILLED",
  "block_number": "15",
  "fill": {
    "solver": "0x...",
    "amount_in": "950000000000000000000",
    "amount_out": "900000000000000000000",
    "tx_hash": "0x...",
    "block_number": "18"
  }
}
```

If the intent is not filled, `fill` is `null`.

Errors: `400` (invalid ID), `404` (not found)

#### List Intents

```
GET /intents?status=open&limit=50&offset=0
```

The `status` filter is optional. Valid values: `open`, `filled`, `cancelled`.

Response `200`:
```json
{
  "intents": [...],
  "pagination": { "limit": 50, "offset": 0, "count": 5 }
}
```

Errors: `400` (invalid status)

---

#### Set Intent Metadata

```
PUT /intents/:id/metadata
```

Stores offchain execution/provenance metadata for an indexed intent.

Request:
```json
{
  "execution_target": "0x...",
  "execution_data": "0x...",
  "required_attestation_subject": "0x...",
  "required_attestation_schema": "0x..."
}
```

All fields are optional. The solver uses this metadata when `API_URL` is configured.

---

#### Reserve Intent Metadata

```
POST /intents/metadata
```

Stores execution metadata before the onchain submit is indexed. The SDK computes `intent_hash`, reserves metadata, submits the signed intent, and the indexer links the reserved metadata to the final `intent_id`.

Request:
```json
{
  "intent_hash": "0x...",
  "owner": "0x...",
  "execution_target": "0x...",
  "execution_data": "0x...",
  "required_attestation_subject": "0x...",
  "required_attestation_schema": "0x..."
}
```

Response `201`: pending metadata row.

---

### Policies

#### Get Account Policies

```
GET /accounts/:address/policies?limit=50&offset=0
```

Response `200`:
```json
{
  "account": "0x...",
  "policies": [
    {
      "policy_type": "SPEND_LIMIT",
      "token": "0x1111111111111111111111111111111111111111",
      "max_per_day": "10000000000000000000000",
      "block_number": "12"
    },
    {
      "policy_type": "TARGET_ALLOWLIST",
      "target": "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
      "allowed": true,
      "block_number": "13"
    }
  ],
  "pagination": { "limit": 50, "offset": 0, "count": 2 }
}
```

Errors: `400` (invalid address)

---

### Policy Preflight

```
POST /preflight
```

Checks indexed account policies before an agent signs or submits a transaction.

Request:
```json
{
  "account": "0x...",
  "target": "0x...",
  "value": "0",
  "data": "0x"
}
```

Response:
```json
{
  "allowed": true,
  "action": "ERC20 transfer from 0x...",
  "reasons": [],
  "missing_policies": [],
  "spend_checks": [],
  "required_policy_updates": []
}
```

---

### Solver Bids

Bid commitment and selection are onchain through `IntentBook.submitBid` and `IntentBook.selectBid`. The API mirrors indexed bid events so agents can inspect the market without scanning logs themselves.

#### Create Bid

```
POST /intents/:id/bids
```

Legacy/development helper for inserting an offchain bid row. Production solver bids should use the onchain `IntentBook.submitBid` function.

Request:
```json
{
  "solver": "0x...",
  "amount_in": "1000",
  "amount_out": "950",
  "fee": "5",
  "valid_until": "1779633720",
  "execution_plan": { "route": "demo" }
}
```

#### List Bids

```
GET /intents/:id/bids?status=open
```

Bids are ordered best-first by output amount, input amount, fee, then creation order.

#### Select Bid

```
POST /bids/:bidId/select
```

Legacy/development helper for selecting an offchain bid row. Production selection should use the onchain `IntentBook.selectBid(intentId, chainBidId)` function. When a bid is selected onchain, `IntentBook.fillIntent` enforces the selected solver and exact bid amounts.

---

### Attestation Schemas

```
GET /attestations/schemas
GET /attestations/schemas/:schemaHash
POST /attestations/schemas
```

Built-in schemas include `solver_reputation`, `tool_capability`, `model_provider`, and `safety_review`.

---

### Solvers

#### Get Solver

```
GET /solvers/:id
```

Returns solver operator, metadata, capabilities hash, bond, active status, fill counters, average latency blocks, and average output surplus.

#### List Solvers

```
GET /solvers?active=true&operator=0x...&limit=50&offset=0
```

Both filters are optional.

---

### Attestors

#### Get Attestor

```
GET /attestors/:id
```

Returns attestor operator, metadata, schema hash, active status, and indexed attestation counters.

#### List Attestors

```
GET /attestors?active=true&operator=0x...&limit=50&offset=0
```

Both filters are optional.

---

### Commerce

#### List Merchants

```
GET /merchants?owner=0x...&active=true&limit=50&offset=0
```

Filters are optional. Returns registered merchant owners, payout addresses, metadata URIs/hashes, active status, and block metadata.

#### Get Merchant

```
GET /merchants/:id
```

Errors: `400` (invalid ID), `404` (not found)

#### List Services

```
GET /services?merchant_id=1&capability_hash=0x...&active=true&limit=50&offset=0
```

Filters are optional. Services include merchant ID, service ID, metadata URI/hash, capability hash, and active status.

#### Get Service

```
GET /services/:id
```

Errors: `400` (invalid ID), `404` (not found)

#### List Facilitators

```
GET /facilitators?active=true&limit=50&offset=0
```

Returns facilitator address, metadata URI/hash, active status, and block metadata.

#### Get Quote

```
GET /quotes/:quoteHash
```

Response `200`:
```json
{
  "quote_hash": "0x...",
  "merchant_id": "1",
  "service_numeric_id": "1",
  "agent": "0x...",
  "token": "0x...",
  "facilitator": "0x...",
  "amount": "1000000000000000000",
  "payment_rail": 3,
  "protocol_fee_bps": 0,
  "protocol_fee_amount": "0",
  "expires_at": "1779652362",
  "payment_nonce": "1",
  "resource_hash": "0x...",
  "terms_hash": "0x...",
  "x402_payload_hash": "0x...",
  "settled": true
}
```

Payment rails are `0=transfer`, `1=swap`, `2=facilitator`, and `3=x402`. The `x402_payload_hash` is used when the payment rail is x402. For basic transfers or swaps, quote terms can bind the payment data through the resource/terms hashes and normal policy checks.

#### List Receipts

```
GET /receipts?agent=0x...&merchant_id=1&limit=50&offset=0
```

Returns settled commerce receipts with amount, token, payment rail, facilitator, result hash, resource hash, fulfillment hash, and zero-fee protocol instrumentation.

#### Get Merchant Reputation

```
GET /merchants/:id/reputation
```

Returns merchant details plus receipt count, settled volume, fulfilled receipt count, dispute counts, and trust signal counts grouped by kind.

#### List Trust Signals

```
GET /trust-signals?subject_type=0&subject_id=1&kind=0&reporter=0x...&limit=50&offset=0
```

Trust signal subject types are `0=merchant`, `1=service`, `2=facilitator`, and `3=agent`. Kinds are `0=verification`, `1=risk`, `2=compliance`, and `3=fulfillment`.

#### List Disputes

```
GET /disputes?receipt_id=1&limit=50&offset=0
```

Returns receipt-linked dispute status, opener, reason hash, resolution hash, and block metadata.

---

### Commerce Analytics

```
GET /analytics/commerce
```

Returns dashboard-ready protocol metrics.

Response `200`:
```json
{
  "summary": {
    "merchants": "1",
    "active_merchants": "1",
    "services": "1",
    "active_services": "1",
    "facilitators": "1",
    "active_facilitators": "1",
    "quotes": "1",
    "settled_quotes": "1",
    "quoted_volume": "1000000000000000000",
    "quoted_protocol_fees": "0",
    "receipts": "1",
    "settled_volume": "1000000000000000000",
    "settled_protocol_fees": "0",
    "disputes": "1",
    "open_disputes": "0",
    "resolved_disputes": "1",
    "rejected_disputes": "0"
  },
  "volume_by_token": [],
  "top_merchants": [],
  "top_services": [],
  "facilitator_volume": [],
  "volume_by_payment_rail": [],
  "trust_signals_by_kind": []
}
```

Protocol fee fields are currently instrumented but set to zero by `CommerceRegistry.PROTOCOL_FEE_BPS`.

---

### Transaction Explain

#### Explain Transaction

```
GET /tx/:hash/explain
```

Returns a human-readable and machine-readable summary of a transaction's events.

Response `200`:
```json
{
  "tx_hash": "0x...",
  "block_number": "15",
  "summary": "Transaction contained 1 event(s)",
  "events": [
    {
      "eventName": "IntentSubmitted",
      "args": { "intentId": "1", "owner": "0x...", "nonce": "42" },
      "description": "Intent #1 submitted by 0x..."
    }
  ]
}
```

Errors: `400` (invalid hash), `404` (not found)

---

## Common Parameters

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `limit` | 50 | 100 | Number of results per page |
| `offset` | 0 | — | Number of results to skip |

## Notes

- All addresses are normalized to lowercase.
- NUMERIC/BIGINT values are returned as strings for BigInt safety.
- All error responses follow the format `{ "error": "message" }`.
