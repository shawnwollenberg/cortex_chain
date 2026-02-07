const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export function parsePagination(query: Record<string, unknown>): { limit: number; offset: number } {
  let limit = parseInt(String(query.limit ?? DEFAULT_LIMIT), 10);
  if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  let offset = parseInt(String(query.offset ?? 0), 10);
  if (isNaN(offset) || offset < 0) offset = 0;

  return { limit, offset };
}

export function isValidAddress(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}

export function isValidId(s: string): boolean {
  return /^\d+$/.test(s);
}

export function isValidTxHash(s: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(s);
}
