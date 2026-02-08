# REST API Reference

Base URL: `http://localhost:3001` (configurable via `API_PORT`)

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
