import { z } from "zod";
import { API_URL } from "../config.js";

export const listOpenIntentsSchema = {
  status: z.string().optional().default("OPEN").describe("Intent status filter (default: OPEN)"),
  limit: z.number().optional().default(50).describe("Max results to return"),
};

export async function listOpenIntents(args: { status?: string; limit?: number }): Promise<string> {
  const params = new URLSearchParams();
  params.set("status", args.status ?? "OPEN");
  params.set("limit", String(args.limit ?? 50));

  const res = await fetch(`${API_URL}/intents?${params}`);
  if (!res.ok) {
    const body = await res.text();
    return `Error ${res.status}: ${body}`;
  }
  const data = await res.json();
  return JSON.stringify(data, null, 2);
}
