"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { decodeEventLog, isHash, type Hash } from "viem";
import { usePublicClient } from "wagmi";
import { Icon, Mark } from "@/components/icon";
import { ThemeToggle } from "@/components/theme";
import { CopyButton, Notice, TxLink } from "@/components/ui";
import { freeditAbi } from "@/lib/abi/freedit";
import { shortAddress, usd } from "@/lib/format";
import { projectTitle, useProjectMeta } from "@/lib/meta";
import { chain, explorerTx, network } from "@/lib/network";

/** Public receipt, decoded from the payment transaction's Paid event. No sign-in. Nothing here can be edited. */
export function Receipt({ tx }: { tx: string }) {
  const client = usePublicClient();
  const valid = isHash(tx);
  const q = useQuery({
    queryKey: ["receipt", chain.id, tx],
    enabled: valid && !!client,
    queryFn: async () => {
      const receipt = await client!.getTransactionReceipt({ hash: tx as Hash });
      const log = receipt.logs.find((l) => l.address.toLowerCase() === network.freedit?.toLowerCase() && (() => {
        try { return decodeEventLog({ abi: freeditAbi, data: l.data, topics: l.topics }).eventName === "Paid"; } catch { return false; }
      })());
      if (!log) return { receipt, paid: undefined, timestamp: undefined };
      const ev = decodeEventLog({ abi: freeditAbi, data: log.data, topics: log.topics });
      const block = await client!.getBlock({ blockNumber: receipt.blockNumber });
      return { receipt, paid: ev.eventName === "Paid" ? ev.args : undefined, timestamp: Number(block.timestamp) };
    },
  });
  const paid = q.data?.paid;
  const meta = useProjectMeta(paid?.id);

  return (
    <main className="receipt">
      <div className="between" style={{ marginBottom: 28 }}>
        <Link href="/" className="brand"><Mark />Freedit</Link>
        <span className="row g12"><span className="muted" style={{ fontSize: 13 }}>Payment receipt</span><ThemeToggle /></span>
      </div>

      {!valid ? (
        <Notice tone="bad">That isn&apos;t a transaction hash.</Notice>
      ) : q.isLoading ? (
        <div style={{ display: "grid", gap: 12 }}><div className="skeleton" style={{ height: 48, width: 240 }} /><div className="skeleton" style={{ height: 260 }} /></div>
      ) : q.error ? (
        <Notice tone="bad">Couldn&apos;t find this transaction on {network.label}. If it was sent moments ago, reload in a few seconds.</Notice>
      ) : !paid ? (
        <Notice tone="warn">This transaction exists, but it isn&apos;t a Freedit payment on {network.label}. <a className="link" href={explorerTx(tx)} target="_blank" rel="noreferrer">View it on the explorer</a></Notice>
      ) : (
        <>
          <div className="row ok" style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}><Icon name="check" size="sm" />Confirmed on Arc</div>
          <div className="amount num" style={{ fontSize: 38 }}>{usd(paid.amount)}<small>USDC</small></div>
          <div className="muted" style={{ margin: "4px 0 22px" }}>
            Paid {q.data?.timestamp ? new Date(q.data.timestamp * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : ""} · {network.label}
          </div>
          <div className="card" style={{ padding: "18px 20px" }}>
            <dl className="kv" style={{ gridTemplateColumns: "150px 1fr" }}>
              <dt>Project</dt><dd><Link className="link" href={`/p/${paid.id}`}>{projectTitle(paid.id, meta)}</Link> <span className="faint">#{paid.id.toString()}</span></dd>
              <dt>Editor (paid)</dt><dd className="row" style={{ gap: 6 }}><span className="addr">{shortAddress(paid.editor)}</span><CopyButton value={paid.editor} /></dd>
              <dt>Client (paid by)</dt><dd className="row" style={{ gap: 6 }}><span className="addr">{shortAddress(paid.client)}</span><CopyButton value={paid.client} /></dd>
              <dt>Approved version</dt><dd>V{paid.version}</dd>
              <dt>File fingerprint</dt><dd className="mono" style={{ overflowWrap: "anywhere" }}>{paid.fileHash}</dd>
              <dt>Transaction</dt><dd><TxLink hash={tx} /></dd>
              <dt>Block</dt><dd className="mono num">{q.data?.receipt.blockNumber.toLocaleString()}</dd>
            </dl>
          </div>
          <div className="between wrap" style={{ marginTop: 14, fontSize: 12.5 }}>
            <span className="row muted"><Icon name="shield" size="xs" />Read live from the Freedit contract. Freedit never held these funds.</span>
            <a className="link" href={explorerTx(tx)} target="_blank" rel="noreferrer">View on the explorer <Icon name="ext" size="xs" /></a>
          </div>
        </>
      )}
    </main>
  );
}
