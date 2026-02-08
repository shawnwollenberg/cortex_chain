import { z } from "zod";
import { API_URL } from "../config.js";

export const lookupAttestationSchema = {
  attestationId: z.string().describe("The numeric attestation ID to look up"),
};

export async function lookupAttestation(args: { attestationId: string }): Promise<string> {
  const res = await fetch(`${API_URL}/attestations/${args.attestationId}`);
  if (!res.ok) {
    const body = await res.text();
    return `Error ${res.status}: ${body}`;
  }
  const data = await res.json();
  return JSON.stringify(data, null, 2);
}
