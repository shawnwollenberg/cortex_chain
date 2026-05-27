import { keccak256, toBytes } from "viem";

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

export function canonicalizeJsonText(value: string): string {
  return canonicalizeJson(JSON.parse(value) as unknown);
}

export function hashCanonicalJsonText(value: string) {
  return keccak256(toBytes(canonicalizeJsonText(value)));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)]),
  );
}
