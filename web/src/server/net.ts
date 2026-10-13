import { cookies, headers } from "next/headers";
import { defaultNetwork, isSwitchableNetwork, NETWORK_COOKIE, NETWORK_HEADER, netFor, switchable, type Net } from "@/lib/network";

/**
 * The Arc network a request is for: the header this site's pages send with every API call (so a page keeps its
 * network even if another tab switches), else the switch's cookie, else the build default. Every check that
 * follows (contract reads, sessions, storage rows) uses this one network.
 */
export async function requestNet(): Promise<Net> {
  if (!switchable) return netFor(defaultNetwork);
  const fromHeader = (await headers()).get(NETWORK_HEADER);
  if (isSwitchableNetwork(fromHeader)) return netFor(fromHeader);
  const fromCookie = (await cookies()).get(NETWORK_COOKIE)?.value;
  return netFor(isSwitchableNetwork(fromCookie) ? fromCookie : defaultNetwork);
}

/** The network a Sign-In with Ethereum message names, if this site serves it. */
export function netForChainId(chainId: number | undefined): Net | null {
  const names = switchable ? (["mainnet", "testnet"] as const) : [defaultNetwork];
  for (const name of names) {
    const n = netFor(name);
    if (n.chain.id === chainId) return n;
  }
  return null;
}
