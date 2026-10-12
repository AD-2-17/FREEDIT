import { parseGwei, type PublicClient } from "viem";

/** Arc's minimum base fee. A maxFeePerGas below it is dropped without an error receipt (docs: evm-differences). */
export const MIN_BASE_FEE = parseGwei("20");
/** Priority fee 0 is accepted; 1 gwei is the suggested value under load (docs: gas-and-fees). */
const MIN_PRIORITY_FEE = parseGwei("1");

/** Fee fields for every Freedit write, clamped so a transaction can never be silently dropped. */
export async function arcFees(client: PublicClient) {
  let maxFeePerGas = 0n;
  let maxPriorityFeePerGas = MIN_PRIORITY_FEE;
  try {
    const est = await client.estimateFeesPerGas();
    maxFeePerGas = est.maxFeePerGas;
    if (est.maxPriorityFeePerGas > maxPriorityFeePerGas) maxPriorityFeePerGas = est.maxPriorityFeePerGas;
  } catch {
    // fall through to the floor below
  }
  const floor = MIN_BASE_FEE * 2n + maxPriorityFeePerGas;
  if (maxFeePerGas < floor) maxFeePerGas = floor;
  return { maxFeePerGas, maxPriorityFeePerGas };
}
