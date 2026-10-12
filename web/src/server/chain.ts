import { BaseError, ContractFunctionRevertedError, createPublicClient, fallback, http, type Address, type Hex } from "viem";
import { freeditAbi } from "@/lib/abi/freedit";
import { chain, network, rpcUrls } from "@/lib/network";

/** Server-side reads of the Freedit contract. The server trusts Arc, never the browser, for who's who and "paid". */
export const publicClient = createPublicClient({ chain, transport: fallback(rpcUrls.map((url) => http(url))) });

export type OnchainProject = {
  editor: Address;
  client: Address;
  version: number;
  paid: boolean;
  latestFileHash: Hex;
};

/** The project, or null if the id doesn't exist on this network. Other RPC failures throw. */
export async function readProject(id: bigint): Promise<OnchainProject | null> {
  if (!network.freedit) return null;
  try {
    const p = await publicClient.readContract({ address: network.freedit, abi: freeditAbi, functionName: "getProject", args: [id] });
    return { editor: p.editor, client: p.client, version: p.version, paid: p.paid, latestFileHash: p.latestFileHash };
  } catch (e) {
    const revert = e instanceof BaseError ? (e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null) : null;
    if (revert?.data?.errorName === "UnknownProject") return null;
    throw e;
  }
}
