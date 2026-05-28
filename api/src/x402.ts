import { keccak256, toBytes } from "viem";
import { canonicalizeJson } from "./canonical-json.js";

export type X402NormalizationResult = {
  normalized: Record<string, unknown>;
  canonicalJson: string;
  payloadHash: `0x${string}`;
  warnings: string[];
};

const NORMALIZED_SCHEMA = "cortex.x402-payment-requirement.v1";

export function normalizeX402Requirement(input: unknown): X402NormalizationResult {
  const warnings: string[] = [];
  const source = parseInput(input);
  const requirement = selectRequirement(source, warnings);
  const facilitator = objectField(requirement.facilitator);

  const normalized = stripUndefined({
    schema: NORMALIZED_SCHEMA,
    scheme: lowerString(first(requirement.scheme, requirement.kind, requirement.authorization_scheme)),
    network: lowerString(first(requirement.network, requirement.chain)),
    chain_id: numberOrString(first(requirement.chain_id, requirement.chainId)),
    resource: stringField(first(requirement.resource, requirement.resource_url, requirement.url)),
    method: upperString(requirement.method),
    pay_to: lowerString(first(requirement.pay_to, requirement.payTo, requirement.recipient, requirement.receiver)),
    asset: lowerString(first(requirement.asset, requirement.token)),
    amount: stringField(first(requirement.amount, requirement.maxAmountRequired, requirement.max_amount_required, requirement.value)),
    facilitator_url: stringField(first(facilitator.url, requirement.facilitator_url)),
    facilitator_address: lowerString(first(facilitator.address, requirement.facilitator_address)),
    expires_at: stringField(first(requirement.expires_at, requirement.expiresAt, requirement.expiration)),
    nonce: stringField(requirement.nonce),
  });

  validateNormalized(normalized, warnings);

  const canonicalJson = canonicalizeJson(normalized);
  return {
    normalized,
    canonicalJson,
    payloadHash: keccak256(toBytes(canonicalJson)).toLowerCase() as `0x${string}`,
    warnings,
  };
}

function parseInput(input: unknown): Record<string, unknown> {
  const value = typeof input === "string" ? JSON.parse(input) as unknown : input;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("payment_requirement_json must be a JSON object");
  }
  return value as Record<string, unknown>;
}

function selectRequirement(source: Record<string, unknown>, warnings: string[]): Record<string, unknown> {
  if (Array.isArray(source.accepts)) {
    if (source.accepts.length === 0) throw new Error("payment_requirement_json accepts array is empty");
    if (source.accepts.length > 1) warnings.push("accepted payment requirements were present; normalized accepts[0]");
    const selected = source.accepts[0];
    if (!selected || typeof selected !== "object" || Array.isArray(selected)) {
      throw new Error("payment_requirement_json accepts[0] must be a JSON object");
    }
    return selected as Record<string, unknown>;
  }
  return source;
}

function validateNormalized(normalized: Record<string, unknown>, warnings: string[]): void {
  const missing = [
    ["scheme", normalized.scheme],
    ["asset", normalized.asset],
    ["amount", normalized.amount],
    ["pay_to", normalized.pay_to],
  ].filter(([, value]) => !value).map(([field]) => field);

  if (!normalized.network && !normalized.chain_id) missing.push("network_or_chain_id");
  if (missing.length > 0) throw new Error(`payment_requirement_json is missing ${missing.join(", ")}`);
  if (!normalized.resource) warnings.push("resource was not present in the payment requirement");
  if (!normalized.facilitator_url && !normalized.facilitator_address) {
    warnings.push("facilitator identity was not present in the payment requirement");
  }
}

function first(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function objectField(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringField(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value).trim();
}

function lowerString(value: unknown): string | undefined {
  return stringField(value)?.toLowerCase();
}

function upperString(value: unknown): string | undefined {
  return stringField(value)?.toUpperCase();
}

function numberOrString(value: unknown): string | number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return stringField(value);
}

function stripUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
