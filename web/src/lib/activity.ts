"use client";

import { useQuery } from "@tanstack/react-query";
import { decodeEventLog, pad, toHex, type Hex, type Log } from "viem";
import { usePublicClient } from "wagmi";
import { freeditAbi } from "./abi/freedit";
import { chain, explorerApi, network } from "./network";

export type Activity =
  | { kind: "created"; price: bigint; freeRevisions: number; revisionFee: bigint }
  | { kind: "version"; version: number; fileHash: Hex; previewURI: string }
  | { kind: "revision"; n: number; paidFee: bigint; noteHash: Hex; version: number }
  | { kind: "paid"; amount: bigint; version: number; fileHash: Hex };

export type ActivityItem = Activity & { txHash: Hex; blockNumber: bigint; logIndex: number; timestamp?: number };

type RawLog = { topics: (Hex | null)[]; data: Hex; transactionHash: Hex; blockNumber: Hex | bigint; logIndex: Hex | number; timeStamp?: Hex };

function decode(raw: RawLog): ActivityItem | undefined {
  try {
    const topics = raw.topics.filter((t): t is Hex => !!t) as [Hex, ...Hex[]];
    const ev = decodeEventLog({ abi: freeditAbi, data: raw.data, topics });
    const meta = {
      txHash: raw.transactionHash,
      blockNumber: BigInt(raw.blockNumber),
      logIndex: Number(raw.logIndex),
      timestamp: raw.timeStamp ? Number(BigInt(raw.timeStamp)) : undefined,
    };
    switch (ev.eventName) {
      case "ProjectCreated":
        return { kind: "created", price: ev.args.price, freeRevisions: ev.args.freeRevisions, revisionFee: ev.args.revisionFee, ...meta };
      case "VersionSubmitted":
        return { kind: "version", version: ev.args.version, fileHash: ev.args.fileHash, previewURI: ev.args.previewURI, ...meta };
      case "RevisionRequested":
        return { kind: "revision", n: ev.args.n, paidFee: ev.args.paidFee, noteHash: ev.args.noteHash, version: ev.args.version, ...meta };
      case "Paid":
        return { kind: "paid", amount: ev.args.amount, version: ev.args.version, fileHash: ev.args.fileHash, ...meta };
    }
  } catch {
    return undefined;
  }
}

/** Every event for one project, oldest first. The explorer's indexed log API has no block-range limit;
 *  plain RPC is capped at 10,000 blocks per query on Arc (tested 10-12), so RPC is used only on the local fork. */
async function fetchActivity(id: bigint, client: ReturnType<typeof usePublicClient>): Promise<ActivityItem[]> {
  const address = network.freedit!;
  let raws: RawLog[];
  if (network.activity === "explorer") {
    const url = `${explorerApi}?module=logs&action=getLogs&fromBlock=${network.deployBlock}&toBlock=latest&address=${address}&topic1=${pad(toHex(id))}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`explorer ${res.status}`);
    const json = (await res.json()) as { result?: RawLog[] | string };
    raws = Array.isArray(json.result) ? json.result : [];
  } else {
    if (!client) return [];
    const latest = await client.getBlockNumber();
    const from = latest > 9_999n ? latest - 9_999n : 0n;
    const logs = (await client.getLogs({ address, fromBlock: from > network.deployBlock ? from : network.deployBlock, toBlock: latest })) as Log[];
    raws = logs.filter((l) => l.topics[1] === pad(toHex(id))).map((l) => ({
      topics: l.topics as Hex[],
      data: l.data,
      transactionHash: l.transactionHash!,
      blockNumber: l.blockNumber!,
      logIndex: l.logIndex!,
    }));
    const blocks = new Map<bigint, number>();
    for (const r of raws) {
      const n = BigInt(r.blockNumber);
      if (!blocks.has(n)) blocks.set(n, Number((await client.getBlock({ blockNumber: n })).timestamp));
      r.timeStamp = toHex(blocks.get(n)!);
    }
  }
  return raws
    .map(decode)
    .filter((x): x is ActivityItem => !!x)
    .sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1));
}

/**
 * Fetched once per page view, then again only when `stateKey` changes (new version, revision or payment,
 * which the 8 s contract poll notices). The explorer API rate-limits (429 seen on 10-12), so no interval polling.
 * Pass `stateKey` undefined until the project has loaded, so missing projects never hit the explorer.
 */
export function useActivity(id: bigint | undefined, stateKey: string | undefined) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["activity", chain.id, id?.toString(), stateKey],
    queryFn: () => fetchActivity(id!, client),
    enabled: !!id && !!network.freedit && stateKey !== undefined,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
    retry: 2,
    retryDelay: (attempt) => 2_000 * 2 ** attempt,
  });
}
