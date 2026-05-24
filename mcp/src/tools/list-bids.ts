import { z } from "zod";
import { API_URL } from "../config.js";

export const listBidsSchema = {
  intent_id: z.string().describe("Intent ID"),
  status: z.string().optional().describe("Optional bid status filter"),
};

export async function listBids(args: { intent_id: string; status?: string }): Promise<string> {
  const params = args.status ? `?status=${encodeURIComponent(args.status)}` : "";
  const res = await fetch(`${API_URL}/intents/${args.intent_id}/bids${params}`);
  if (!res.ok) return `Failed to list bids: ${res.status} ${res.statusText}`;
  return JSON.stringify(await res.json(), null, 2);
}
