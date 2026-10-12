"use client";

import { BaseError, ContractFunctionRevertedError, erc20Abi, HttpRequestError, TimeoutError, UserRejectedRequestError, type Address, type Hash } from "viem";
import type { Config } from "wagmi";
import { getPublicClient, readContract, simulateContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { freeditAbi } from "./abi/freedit";
import { SignInError } from "./api";
import { arcFees } from "./fees";
import { chain, network, USDC } from "./network";
import { usd } from "./format";

type FreeditCall =
  | { functionName: "createProject"; args: readonly [Address, bigint, number, bigint] }
  | { functionName: "submitVersion"; args: readonly [bigint, Hash, string] }
  | { functionName: "requestRevision"; args: readonly [bigint, Hash] }
  | { functionName: "approveAndPay"; args: readonly [bigint, Hash] };

/** Simulate (to surface a clear revert reason), send with Arc-safe fees, wait for the one confirmation Arc needs. */
export async function sendFreedit(config: Config, account: Address, call: FreeditCall) {
  const client = getPublicClient(config)!;
  const { request } = await simulateContract(config, { address: network.freedit!, abi: freeditAbi, account, ...call } as never);
  const hash = await writeContract(config, { ...(request as object), ...(await arcFees(client)) } as never);
  const receipt = await waitForTransactionReceipt(config, { hash });
  if (receipt.status !== "success") throw new Error("The transaction failed on Arc.");
  return { hash, receipt };
}

export async function usdcBalance(config: Config, owner: Address) {
  return readContract(config, { address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [owner] });
}

export async function usdcAllowance(config: Config, owner: Address) {
  return readContract(config, { address: USDC, abi: erc20Abi, functionName: "allowance", args: [owner, network.freedit!] });
}

/** Approve exactly `amount` for Freedit if the current allowance is short. Returns the tx hash, or null if skipped. */
export async function ensureAllowance(config: Config, owner: Address, amount: bigint): Promise<Hash | null> {
  if ((await usdcAllowance(config, owner)) >= amount) return null;
  const client = getPublicClient(config)!;
  const hash = await writeContract(config, {
    address: USDC,
    abi: erc20Abi,
    functionName: "approve",
    args: [network.freedit!, amount],
    account: owner,
    ...(await arcFees(client)),
  } as never);
  const receipt = await waitForTransactionReceipt(config, { hash });
  if (receipt.status !== "success") throw new Error("The USDC approval failed on Arc.");
  return hash;
}

const reasons: Record<string, string> = {
  NotClient: "Only the client's wallet can do this. Switch to the wallet this project was created for.",
  NotEditor: "Only the editor's wallet can do this.",
  AlreadyPaid: "This project is already paid.",
  FileHashMismatch: "The editor uploaded a newer version while you were reviewing. Reload and review it first.",
  RevisionAlreadyOpen: "You already asked for changes. Wait for the editor's next version.",
  NoVersionYet: "The editor hasn't uploaded a version yet.",
  RevisionLimitReached: "This project has reached the maximum of 255 revisions.",
  EditorIsClient: "The client wallet must be different from yours.",
  ZeroAddress: "Enter the client's wallet address.",
  ZeroPrice: "The price must be more than $0.",
  EmptyFileHash: "The file fingerprint is missing. Choose the file again.",
  UnknownProject: "This project doesn't exist on this network.",
  ERC20InsufficientBalance: "Not enough USDC in this wallet.",
  ERC20InsufficientAllowance: "The USDC allowance is too low. Try again and confirm the allowance step.",
};

/** The contract's custom error name (e.g. "UnknownProject") if this error is a revert, else undefined. */
export function revertName(e: unknown): string | undefined {
  if (!(e instanceof BaseError)) return undefined;
  const revert = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
  return revert?.data?.errorName ?? (revert ? "reverted" : undefined);
}

/**
 * Turns wallet and contract errors into one plain sentence. Unknown errors keep a short technical detail so a
 * report says what actually failed; the full error always goes to the browser console.
 */
export function explainError(e: unknown): string {
  console.error("[freedit]", e);
  if (e instanceof SignInError) return `Signing in didn't work: ${explainError(e.cause)}`;
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError)) return "You cancelled in your wallet. Nothing was sent.";
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const name = revert?.data?.errorName;
    if (name && reasons[name]) return reasons[name];
    if (revert?.reason) return revert.reason === "Blocked address" ? "One of these wallets is blocked on Arc, so USDC can't move." : revert.reason;
    if (/insufficient funds/i.test(e.message)) return "Not enough USDC for the network fee.";
    // This page's own call to Arc's RPC (simulation, receipt) got no usable answer.
    const http = e.walk((x) => x instanceof HttpRequestError || x instanceof TimeoutError);
    if (http) {
      const status = http instanceof HttpRequestError && http.status ? ` (HTTP ${http.status})` : "";
      return `Couldn't reach ${network.label} just now${status}. Nothing was sent. Check your connection and try again.`;
    }
    // The wallet's own connection to the network failed (it uses the RPC URL saved in the wallet, not ours).
    if (/rpc endpoint|failed to fetch|fetch failed|\bhttp (request|error|client)|status code/i.test(e.details ?? "")) {
      return `Your wallet couldn't reach ${network.label}. In your wallet's network settings, check the RPC URL is ${chain.rpcUrls.default.http[0]}, then try again.`;
    }
    return withDetail(e.shortMessage, e.details);
  }
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

const withDetail = (message: string, detail?: string) =>
  detail && !message.includes(detail) ? `${message} (${detail.length > 160 ? `${detail.slice(0, 160)}…` : detail})` : message;

export function needsFunds(balance: bigint | undefined, amount: bigint) {
  // USDC is also the gas token, so keep a cent of headroom for the network fee.
  const buffer = 10_000n; // $0.01
  if (balance === undefined) return undefined;
  return balance < amount + buffer ? `You have ${usd(balance)}. You need ${usd(amount)} plus a network fee under $0.01.` : undefined;
}
