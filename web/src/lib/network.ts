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
// The name is what the wallet's "add network" prompt shows. MetaMask flags a name that isn't part of the public
// registry's entry for this chain id (chainid.network: "Arc Network Testnet"), so we use that exact name.
const arcTestnetDocs = defineChain({
  ...arcTestnet,
  name: "Arc Network Testnet",
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
  /** Node providers listed in docs.arc.io (connect-to-arc), tried in order when the main RPC fails (checked 10-12). */
  rpcBackups: string[];
};

const networks: Record<NetworkName, NetworkConfig> = {
  testnet: {
    chain: arcTestnetDocs,
    label: "Arc Testnet",
    freedit: "0xC82aB1b65866b43A0F3794ba6d5EAC0a55df4895",
    deployBlock: 66796009n,
    activity: "explorer",
    rpcBackups: ["https://rpc.blockdaemon.testnet.arc.io", "https://rpc.drpc.testnet.arc.io"],
  },
  mainnet: {
    chain: arcMainnetDocs,
    label: "Arc",
    // Deployed 10-13 (tx 0x26693b1d…0c37), verified on Sourcify (exact match). The deployer's second contract:
    // its first was the one-off Sweep at 0xC82a…4895 that returned $1 sent there by mistake (script/Rescue.s.sol).
    freedit: "0x470D6950a662868d331aE8e9b60d327C1cF9fA9F",
    deployBlock: 25726619n,
    activity: "explorer",
    rpcBackups: ["https://rpc.blockdaemon.mainnet.arc.io", "https://rpc.drpc.mainnet.arc.io", "https://rpc.quicknode.mainnet.arc.io"],
  },
  local: {
    chain: arcLocalFork,
    label: "Local fork",
    freedit: "0xC82aB1b65866b43A0F3794ba6d5EAC0a55df4895", // the fork contains the testnet deployment
    deployBlock: 66796009n,
    activity: "rpc",
    rpcBackups: [],
  },
};

export const network = networks[networkName];
export const chain = network.chain;
/** Main RPC first (also what a wallet gets when it adds the network), then the backups. */
export const rpcUrls = [chain.rpcUrls.default.http[0], ...network.rpcBackups];

/** USDC's ERC-20 interface on Arc: same address on both networks, 6 decimals (docs: contract-addresses). */
export const USDC: Address = "0x3600000000000000000000000000000000000000";
export const USDC_DECIMALS = 6;

const explorer = chain.blockExplorers?.default.url ?? "";
export const explorerTx = (hash: string) => `${explorer}/tx/${hash}`;
export const explorerAddress = (address: string) => `${explorer}/address/${address}`;
export const explorerApi = chain.blockExplorers?.default.apiUrl ?? "";
