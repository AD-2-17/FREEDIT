import { createConfig, fallback, http } from "wagmi";
import { injected, mock } from "wagmi/connectors";
import { chain, rpcUrls } from "./network";

/**
 * Dev-only wallets for the local arc-anvil fork. Anvil's default accounts #2 and #3 (#1 is on Arc's test
 * blocklist). These are publicly known test keys with no value; they're never included outside `local`.
 */
// Compared against the raw env var (inlined at build time) so non-local builds drop this code entirely.
const devConnectors =
  process.env.NEXT_PUBLIC_ARC_NETWORK === "local"
    ? [
        mock({ accounts: ["0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"], features: { reconnect: true } }),
        mock({ accounts: ["0x90F79bf6EB2c4f870365E785982E1f101E93b906"], features: { reconnect: true } }),
      ]
    : [];

/**
 * Where the browser reads Arc: Arc's RPC directly, then this site's own /api/rpc relay. Some browsers block
 * requests to every *.arc.io RPC ("Failed to fetch" on all providers, 10-12) but not to the site itself; the
 * relay also falls back across the docs' node providers server-side. (No window during server rendering.)
 */
const readUrls = typeof window === "undefined" ? rpcUrls : [rpcUrls[0], `${window.location.origin}/api/rpc`];

export const wagmiConfig = createConfig({
  chains: [chain],
  // injected() + EIP-6963 discovery covers MetaMask, Rabby and other browser wallets.
  connectors: [injected(), ...devConnectors],
  transports: { [chain.id]: fallback(readUrls.map((url) => http(url))) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
