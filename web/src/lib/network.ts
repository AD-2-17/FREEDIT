import { defineChain, type Address, type Chain } from "viem";
import { arc, arcTestnet } from "viem/chains";


/**
 * Which Arc network this build talks to. One network per deployment, set by NEXT_PUBLIC_ARC_NETWORK:
 *   testnet (default) · mainnet · local (an arc-anvil fork of testnet on 127.0.0.1:8545, for development only)
 */
export type NetworkName = "testnet" | "mainnet" | "local";

const raw = process.env.NEXT_PUBLIC_ARC_NETWORK;
export const networkName: NetworkName = raw === "mainnet" || raw === "local" ? raw : "testnet";

// viem ships Arc definitions, but its testnet entry points at *.arc.network / arcscan.app.
// We use the hostnames from docs.arc.io (connect-to-arc), which we verified on 10-12.
const arcTestnetDocs = defineChain({
  ...arcTestnet,
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"], webSocket: ["wss://rpc.testnet.arc.io"] } },
  blockExplorers: { default: { name: "Arc Testnet Explorer", url: "https://explorer.testnet.arc.io", apiUrl: "https://explorer.testnet.arc.io/api" } },
});

// Mainnet hostnames match the docs; only the explorer API changes from /api/v2 to the Etherscan-style /api
// that serves module=logs (probed 10-12).
const arcMainnetDocs = defineChain({
  ...arc,
  blockExplorers: { default: { name: "Arc Explorer", url: "https://explorer.arc.io", apiUrl: "https://explorer.arc.io/api" } },
});

const arcLocalFork = defineChain({
  ...arcTestnet,
  name: "Arc Testnet (local fork)",
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
  blockExplorers: arcTestnetDocs.blockExplorers,
});

type NetworkConfig = {
  chain: Chain;
  label: string;
  /** Freedit contract on this network (D12: addresses are public and committed). */
  freedit: Address | undefined;
  /** Block the contract was deployed in; activity is never older than this. */
  deployBlock: bigint;
  /** Where the activity feed reads events: the explorer's indexed log API, or plain RPC (local fork). */
  activity: "explorer" | "rpc";
};

const networks: Record<NetworkName, NetworkConfig> = {
  testnet: {
    chain: arcTestnetDocs,
    label: "Arc Testnet",
    freedit: "0xC82aB1b65866b43A0F3794ba6d5EAC0a55df4895",
    deployBlock: 66796009n,
    activity: "explorer",
  },
  mainnet: {
    chain: arcMainnetDocs,
    label: "Arc",
    freedit: undefined, // set after the Phase 6 mainnet deploy
    deployBlock: 0n,
    activity: "explorer",
  },
  local: {
    chain: arcLocalFork,
    label: "Local fork",
    freedit: "0xC82aB1b65866b43A0F3794ba6d5EAC0a55df4895", // the fork contains the testnet deployment
    deployBlock: 66796009n,
    activity: "rpc",
  },
};

export const network = networks[networkName];
export const chain = network.chain;

/** USDC's ERC-20 interface on Arc: same address on both networks, 6 decimals (docs: contract-addresses). */
export const USDC: Address = "0x3600000000000000000000000000000000000000";
export const USDC_DECIMALS = 6;

const explorer = chain.blockExplorers?.default.url ?? "";
export const explorerTx = (hash: string) => `${explorer}/tx/${hash}`;
export const explorerAddress = (address: string) => `${explorer}/address/${address}`;
export const explorerApi = chain.blockExplorers?.default.apiUrl ?? "";
