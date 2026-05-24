import { z } from "zod";
import { API_URL } from "../config.js";

export const listAttestorsSchema = {
  active: z.boolean().optional().describe("Filter by active status"),
  limit: z.number().optional().default(50).describe("Max results to return"),
};

export async function listAttestors(args: { active?: boolean; limit?: number }): Promise<string> {
  const params = new URLSearchParams();
  if (args.active !== undefined) params.set("active", String(args.active));
  params.set("limit", String(args.limit ?? 50));

  const res = await fetch(`${API_URL}/attestors?${params}`);
  if (!res.ok) {
    const body = await res.text();
    return `Error ${res.status}: ${body}`;
  }
  const data = await res.json();
  return JSON.stringify(data, null, 2);
}
