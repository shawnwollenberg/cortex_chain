import { API_URL } from "../config.js";

export const listAttestationSchemasSchema = {};

export async function listAttestationSchemas(): Promise<string> {
  const res = await fetch(`${API_URL}/attestations/schemas`);
  if (!res.ok) return `Failed to list attestation schemas: ${res.status} ${res.statusText}`;
  return JSON.stringify(await res.json(), null, 2);
}
