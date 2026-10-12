"use client";

import { BaseError, ContractFunctionRevertedError, erc20Abi, UserRejectedRequestError, type Address, type Hash } from "viem";
import type { Config } from "wagmi";
import { getPublicClient, readContract, simulateContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { freeditAbi } from "./abi/freedit";
import { arcFees } from "./fees";
import { network, USDC } from "./network";
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

/** Turns wallet and contract errors into one plain sentence. */
export function explainError(e: unknown): string {
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError)) return "You cancelled in your wallet. Nothing was sent.";
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const name = revert?.data?.errorName;
    if (name && reasons[name]) return reasons[name];
    if (revert?.reason) return revert.reason === "Blocked address" ? "One of these wallets is blocked on Arc, so USDC can't move." : revert.reason;
    if (/insufficient funds/i.test(e.message)) return "Not enough USDC for the network fee.";
    return e.shortMessage;
  }
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

export function needsFunds(balance: bigint | undefined, amount: bigint) {
  // USDC is also the gas token, so keep a cent of headroom for the network fee.
  const buffer = 10_000n; // $0.01
  if (balance === undefined) return undefined;
  return balance < amount + buffer ? `You have ${usd(balance)}. You need ${usd(amount)} plus a network fee under $0.01.` : undefined;
}
