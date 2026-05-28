# Deployment Manifest

This manifest captures the current hosted Base Sepolia deployment and the items that must move when Cortex is split into a new repository or AWS account.

## Hosted URLs

- Web dashboard and docs: `https://cortex.wallyweb.com`
- API: `https://api.cortex.wallyweb.com`
- Base Sepolia RPC target: `https://sepolia.base.org`

## Base Sepolia Contracts

| Contract | Address |
| --- | --- |
| AgentRegistry | `0x24ca7dc7747b0166e73a2d6d99ce677476f046f3` |
| IntentBook | `0x16f7e7c4856bad4dcbe61400630087dab75b229e` |
| PolicyModule | `0xb2686c5cc3ab7ce45acfe0091698d9b6a16c2d0c` |
| AttestationRegistry | `0x62631b3f111424831daa61becb2e7a4bb0f71d2f` |
| SolverRegistry | `0x21cf04bc864953da4c79160f820f38ef74213eea` |
| AttestorRegistry | `0x40f2623f177a400a5928c99f107500049a884da0` |
| CommerceRegistry | `0xf0bf44b28567f0b3d2370dc7af8a63335746d8d4` |
| SettlementAdapter | `0xbD61097Cc7b7E1F03E88Fe20E9512ff091126cb3` |

Indexer start block: `42033933`.

## AWS Resources

Current profile and region:

- AWS profile: `wallyweb`
- Region: `us-east-1`

Expected services:

- ECS service for web/dashboard.
- ECS service for API.
- ECS service for indexer.
- ECR repositories for service images.
- RDS/Postgres for indexed chain and hosted document state.
- DNS records for `cortex.wallyweb.com` and `api.cortex.wallyweb.com`.
- TLS certificates for both hostnames.

## Environment Variables

Move names, not secret values, into the target account or deployment system:

- `AWS_PROFILE`
- `AWS_REGION`
- `DATABASE_URL`
- `RPC_URL`
- `CHAIN_ID`
- `START_BLOCK`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_*_ADDRESS`
- `AGENT_REGISTRY_ADDRESS`
- `INTENT_BOOK_ADDRESS`
- `POLICY_MODULE_ADDRESS`
- `ATTESTATION_REGISTRY_ADDRESS`
- `SOLVER_REGISTRY_ADDRESS`
- `ATTESTOR_REGISTRY_ADDRESS`
- `COMMERCE_REGISTRY_ADDRESS`
- `SETTLEMENT_ADAPTER_ADDRESS`

Never commit deployer private keys, database passwords, RPC credentials, facilitator credentials, or wallet seed material.

## Migration Checklist

1. Create the new repository and copy code, preserving commit history if practical.
2. Create the target AWS account, IAM deployment role, ECR repos, RDS instance, ECS cluster/services, load balancers, DNS, and certificates.
3. Load secrets into the target secret store.
4. Run database migrations against the new Postgres instance.
5. Deploy API, indexer, and web images.
6. Configure `NEXT_PUBLIC_API_URL` to the new API hostname and rebuild the web image.
7. Confirm `/health`, `/analytics/overview`, `/merchants`, `/services`, `/x402/normalize`, and hosted document routes.
8. Smoke test onboarding wallet reads and quote publishing.
9. Point DNS to the new account after API and web health checks pass.
10. Keep the old AWS deployment running until indexed block height, API responses, and dashboard behavior match.

## Hardening Gaps Before Mainnet

- API authentication and rate limiting for write-heavy document routes.
- Scheme-specific x402 signature verification for EIP-3009 and Permit2.
- Facilitator reconciliation between signed authorization, facilitator settlement, and receipt.
- Full structured schema validation for catalogs, quotes, settlement plans, encrypted fulfillment, and evidence.
- Backup and restore drills for RDS.
- Deployment rollback runbook.
