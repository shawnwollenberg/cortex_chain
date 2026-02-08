import { z } from "zod";
import { API_URL } from "../config.js";

export const lookupAgentSchema = {
  agentId: z.string().describe("The numeric agent ID to look up"),
};

export async function lookupAgent(args: { agentId: string }): Promise<string> {
  const res = await fetch(`${API_URL}/agents/${args.agentId}`);
  if (!res.ok) {
    const body = await res.text();
    return `Error ${res.status}: ${body}`;
  }
  const data = await res.json();
  return JSON.stringify(data, null, 2);
}
