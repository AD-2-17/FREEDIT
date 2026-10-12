"use client";

import type { Address, Hex } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { freeditAbi } from "./abi/freedit";
import { network } from "./network";

/** The contract this build talks to, or undefined before it's deployed on the selected network. */
export const freeditAddress = network.freedit;

export type Project = {
  editor: Address;
  freeRevisions: number;
  revisionsUsed: number;
  version: number;
  paid: boolean;
  revisionOpen: boolean;
  client: Address;
  price: bigint;
  revisionFee: bigint;
  latestFileHash: Hex;
  previewURI: string;
};

export type Version = { fileHash: Hex; submittedAt: bigint; previewURI: string };

export type StatusKey = "draft" | "review" | "changes" | "paid";

export function statusOf(p: Project): { key: StatusKey; label: string; color: string } {
  if (p.paid) return { key: "paid", label: "Paid", color: "var(--ok)" };
  if (p.version === 0) return { key: "draft", label: "Waiting for V1", color: "var(--faint)" };
  if (p.revisionOpen) return { key: "changes", label: "Revision requested", color: "var(--warn)" };
  return { key: "review", label: "Awaiting review", color: "var(--accent)" };
}

/** Paid revisions so far. Every request after the free ones was charged the (fixed) revision fee. */
export const paidRevisions = (p: Project) => Math.max(0, p.revisionsUsed - p.freeRevisions);

/** What the editor has received on this project, computed from contract state (no event scan needed). */
export const earned = (p: Project) => (p.paid ? p.price : 0n) + BigInt(paidRevisions(p)) * p.revisionFee;

/** Same rule as the contract's revisionCost(). */
export const nextRevisionCost = (p: Project) => (p.revisionsUsed < p.freeRevisions ? 0n : p.revisionFee);

export { parseId } from "./ids";

const base = { address: freeditAddress, abi: freeditAbi } as const;

export function useProject(id: bigint | undefined) {
  return useReadContract({
    ...base,
    functionName: "getProject",
    args: id ? [id] : undefined,
    // Poll so both sides see each other's actions; stops when the tab is hidden, and once a project is paid.
    query: {
      enabled: !!freeditAddress && !!id,
      refetchInterval: (q) => ((q.state.data as { paid?: boolean } | undefined)?.paid || q.state.error ? false : 8_000),
    },
  });
}

export function useProjects(ids: readonly bigint[]) {
  return useReadContracts({
    contracts: ids.map((id) => ({ ...base, functionName: "getProject" as const, args: [id] as const })),
    query: { enabled: !!freeditAddress && ids.length > 0 },
  });
}

/** Ids where `address` is the editor or the client, newest first, without duplicates. */
export function useProjectIds(address: Address | undefined) {
  const q = useReadContracts({
    contracts: [
      { ...base, functionName: "projectsByEditor", args: address ? [address] : undefined },
      { ...base, functionName: "projectsByClient", args: address ? [address] : undefined },
    ],
    query: { enabled: !!freeditAddress && !!address },
  });
  const asEditor = (q.data?.[0]?.result as readonly bigint[] | undefined) ?? [];
  const asClient = (q.data?.[1]?.result as readonly bigint[] | undefined) ?? [];
  const ids = [...new Set([...asEditor, ...asClient])].sort((a, b) => (a > b ? -1 : 1));
  return { ...q, ids };
}

export function useVersions(id: bigint | undefined, count: number) {
  return useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({ ...base, functionName: "getVersion" as const, args: [id ?? 0n, i + 1] as const })),
    query: { enabled: !!freeditAddress && !!id && count > 0 },
  });
}
