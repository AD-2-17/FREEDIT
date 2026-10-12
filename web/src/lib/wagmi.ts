import { createConfig, http } from "wagmi";
import { injected, mock } from "wagmi/connectors";
import { chain } from "./network";

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

export const wagmiConfig = createConfig({
  chains: [chain],
  // injected() + EIP-6963 discovery covers MetaMask, Rabby and other browser wallets.
  connectors: [injected(), ...devConnectors],
  transports: { [chain.id]: http(chain.rpcUrls.default.http[0]) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
