import { BaseError, ContractFunctionRevertedError, createPublicClient, fallback, http, type Address, type Hex, type PublicClient } from "viem";
import { freeditAbi } from "@/lib/abi/freedit";
import type { Net, NetworkName } from "@/lib/network";

/** Server-side reads of the Freedit contract. The server trusts Arc, never the browser, for who's who and "paid". */
const clients = new Map<NetworkName, PublicClient>();
export function publicClientFor(net: Net): PublicClient {
  let client = clients.get(net.name);
  if (!client) {
    client = createPublicClient({ chain: net.chain, transport: fallback(net.rpcUrls.map((url) => http(url))) }) as PublicClient;
    clients.set(net.name, client);
  }
  return client;
}

export type OnchainProject = {
  editor: Address;
  client: Address;
  version: number;
  paid: boolean;
  latestFileHash: Hex;
};

/** The project, or null if the id doesn't exist on this network. Other RPC failures throw. */
export async function readProject(net: Net, id: bigint): Promise<OnchainProject | null> {
  if (!net.freedit) return null;
  try {
    const p = await publicClientFor(net).readContract({ address: net.freedit, abi: freeditAbi, functionName: "getProject", args: [id] });
    return { editor: p.editor, client: p.client, version: p.version, paid: p.paid, latestFileHash: p.latestFileHash };
  } catch (e) {
    const revert = e instanceof BaseError ? (e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null) : null;
    if (revert?.data?.errorName === "UnknownProject") return null;
    throw e;
  }
}
