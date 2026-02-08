import { z } from "zod";
import { API_URL } from "../config.js";

export const getPolicySchema = {
  account: z.string().describe("The account address (0x...)"),
};

export async function getPolicy(args: { account: string }): Promise<string> {
  const res = await fetch(`${API_URL}/accounts/${args.account}/policies`);
  if (!res.ok) {
    const body = await res.text();
    return `Error ${res.status}: ${body}`;
  }
  const data = await res.json();
  return JSON.stringify(data, null, 2);
}
