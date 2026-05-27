import { keccak256, toBytes } from "viem";

export type CanonicalJson = {
  text: string;
  hash: `0x${string}`;
  sizeBytes: number;
  parsed: Record<string, unknown>;
};

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

export function parseCanonicalJsonDocument(value: unknown, field: string, maxBytes: number): CanonicalJson {
  const text = typeof value === "string" ? value : "";
  if (!text) throw new Error(`${field} is required`);

  const originalSizeBytes = Buffer.byteLength(text, "utf8");
  if (originalSizeBytes > maxBytes) throw new Error(`${field} exceeds ${maxBytes} bytes`);

  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${field} must be a JSON object`);
  }

  const canonicalText = canonicalizeJson(parsed);
  const sizeBytes = Buffer.byteLength(canonicalText, "utf8");
  if (sizeBytes > maxBytes) throw new Error(`canonical ${field} exceeds ${maxBytes} bytes`);

  return {
    text: canonicalText,
    hash: keccak256(toBytes(canonicalText)).toLowerCase() as `0x${string}`,
    sizeBytes,
    parsed: parsed as Record<string, unknown>,
  };
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
