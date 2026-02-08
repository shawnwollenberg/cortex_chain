import { z } from "zod";
import { API_URL } from "../config.js";

export const explainTxSchema = {
  txHash: z.string().describe("The transaction hash (0x...)"),
};

export async function explainTx(args: { txHash: string }): Promise<string> {
  const res = await fetch(`${API_URL}/tx/${args.txHash}/explain`);
  if (!res.ok) {
    const body = await res.text();
    return `Error ${res.status}: ${body}`;
  }
  const data = await res.json();
  return JSON.stringify(data, null, 2);
}
