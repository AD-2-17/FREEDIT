/** Project ids are positive integers starting at 1 (contract: ids start at 1). Shared by browser and server code. */
export function parseId(raw: string): bigint | undefined {
  return /^\d{1,18}$/.test(raw) && raw !== "0" ? BigInt(raw) : undefined;
}
