import { z } from "zod";
import { API_URL } from "../config.js";

export const preflightTransactionSchema = {
  account: z.string().describe("The account address (0x...)"),
  target: z.string().describe("The target contract address (0x...)"),
  value: z.string().optional().default("0").describe("Native value in wei"),
  data: z.string().optional().default("0x").describe("Transaction calldata"),
};

export async function preflightTransaction(args: {
  account: string;
  target: string;
  value?: string;
  data?: string;
}): Promise<string> {
  const res = await fetch(`${API_URL}/preflight`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      account: args.account,
      target: args.target,
      value: args.value ?? "0",
      data: args.data ?? "0x",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return `Error ${res.status}: ${body}`;
  }
  const data = await res.json();
  return JSON.stringify(data, null, 2);
}
