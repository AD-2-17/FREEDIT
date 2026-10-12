"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useConnection } from "wagmi";
import { Icon } from "@/components/icon";
import { Notice, RevisionMeter, Status } from "@/components/ui";
import { WalletButton } from "@/components/wallet";
import { shortAddress, usd } from "@/lib/format";
import { mergeMeta, projectTitle, useLocalMeta, useServerMeta, type ProjectMeta } from "@/lib/meta";
import { network } from "@/lib/network";
import { earned, failureOf, freeditAddress, statusOf, useProjectIds, useProjects, type Project } from "@/lib/project";
import { readFailure } from "@/lib/tx";

type Row = { id: bigint; p: Project; role: "editor" | "client" };
type Tab = "all" | "active" | "paid";

export function Dashboard() {
  const { address, isConnected } = useConnection();
  const { ids, isLoading: idsLoading, error: idsError } = useProjectIds(address);
  const projects = useProjects(ids);
  const serverMeta = useServerMeta(ids);
  const [tab, setTab] = useState<Tab>("all");

  const rows: Row[] = useMemo(() => {
    if (!address || !projects.data) return [];
    return ids.flatMap((id, i) => {
      const p = projects.data?.[i]?.result as Project | undefined;
      if (!p) return [];
      return [{ id, p, role: p.editor.toLowerCase() === address.toLowerCase() ? "editor" : "client" } as Row];
    });
  }, [address, ids, projects.data]);

  if (!freeditAddress) {
    return <div className="page"><Notice tone="warn">Freedit isn&apos;t deployed on {network.label} yet.</Notice></div>;
  }

  if (!isConnected) {
    return (
      <div className="page">
        <div className="page-head"><div><h1 className="title">Projects</h1><div className="sub">Connect your wallet to see projects where you&apos;re the editor or the client.</div></div></div>
        <div className="card empty">
          <b>Connect your wallet</b>
          <p style={{ margin: "0 0 16px" }}>Freedit reads your projects straight from the contract on {network.label}.</p>
          <div style={{ display: "inline-block" }}><WalletButton /></div>
        </div>
      </div>
    );
  }

  const mine = rows.filter((r) => r.role === "editor");
  const theirs = rows.filter((r) => r.role === "client");
  // A wallet that's only ever been a client sees client wording: what it paid, and what it's waiting on.
  const clientOnly = mine.length === 0 && theirs.length > 0;
  const totalEarned = mine.reduce((sum, r) => sum + earned(r.p), 0n);
  const totalPaid = theirs.reduce((sum, r) => sum + earned(r.p), 0n);
  const inProgress = rows.filter((r) => !r.p.paid).length;
  const waitingOnClient = mine.filter((r) => statusOf(r.p).key === "review").length;
  const waitingOnEditor = theirs.filter((r) => ["draft", "changes"].includes(statusOf(r.p).key)).length;
  const waitingOnYou = rows.filter((r) => {
    const k = statusOf(r.p).key;
    return r.role === "editor" ? k === "changes" || k === "draft" : k === "review";
  }).length;
  const shown = rows.filter((r) => (tab === "all" ? true : tab === "paid" ? r.p.paid : !r.p.paid));
  const loading = idsLoading || (ids.length > 0 && projects.isLoading);
  const readError = idsError ?? projects.error ?? failureOf(projects.data);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1 className="title">Projects</h1><div className="sub">Everything you&apos;re editing or reviewing, newest first.</div></div>
        <Link href="/new" className="btn primary"><Icon name="plus" size="sm" />New project</Link>
      </div>

      <div className="stats">
        <div><div className="stat-k">{clientOnly ? "Paid to editors" : "Earned"}</div><div className="stat-v num">{usd(clientOnly ? totalPaid : totalEarned)} <small>USDC</small></div></div>
        <div><div className="stat-k">In progress</div><div className="stat-v num">{inProgress}</div></div>
        <div><div className="stat-k"><i className="dot" style={{ ["--c" as string]: "var(--accent)" }} />{clientOnly ? "Waiting on the editor" : "Waiting on client"}</div><div className="stat-v num">{clientOnly ? waitingOnEditor : waitingOnClient}</div></div>
        <div><div className="stat-k"><i className="dot" style={{ ["--c" as string]: "var(--warn)" }} />Waiting on you</div><div className="stat-v num">{waitingOnYou}</div></div>
      </div>

      <div className="tabs" role="tablist" style={{ marginBottom: 2 }}>
        {([["all", "All", rows.length], ["active", "In progress", inProgress], ["paid", "Paid", rows.length - inProgress]] as const).map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}<span className="n">{n}</span></button>
        ))}
      </div>

      {readError && (
        <div style={{ marginTop: 16 }}>
          <Notice tone="bad">
            Couldn&apos;t read your projects from {network.label}, so this list may be incomplete. Retrying every 10 seconds; check your connection or reload.
            <span className="muted" style={{ display: "block", fontSize: 12, marginTop: 4 }}>{readFailure(readError)}</span>
          </Notice>
        </div>
      )}

      {loading ? (
        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 44 }} />)}</div>
      ) : shown.length === 0 && readError ? null : shown.length === 0 ? (
        <div className="empty">
          <b>{rows.length === 0 ? "No projects yet" : "Nothing here"}</b>
          {rows.length === 0 && <p style={{ margin: "0 0 16px" }}>Create one, or ask your editor to create one for this wallet.</p>}
          {rows.length === 0 && <Link href="/new" className="btn primary"><Icon name="plus" size="sm" />New project</Link>}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="list">
            <thead>
              <tr><th>Project</th><th>Status</th><th>Next step</th><th>Revisions</th><th className="r">Price</th><th className="r">{clientOnly ? "Paid" : "Earned"}</th><th><span className="sr-only">Open</span></th></tr>
            </thead>
            <tbody>{shown.map((r) => <ProjectRow key={r.id.toString()} row={r} server={serverMeta.data?.[r.id.toString()]} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProjectRow({ row: { id, p, role }, server }: { row: Row; server?: ProjectMeta }) {
  const router = useRouter();
  const local = useLocalMeta(id);
  const meta = mergeMeta(local, server);
  const status = statusOf(p);
  const href = `/p/${id}`;
  const other = role === "editor" ? p.client : p.editor;
  const otherName = role === "editor" ? meta.clientName : meta.editorName;

  let next: React.ReactNode;
  if (status.key === "paid") next = <span className="row muted"><Icon name="check" size="xs" className="ok" />Delivered</span>;
  else if (role === "editor" && (status.key === "changes" || status.key === "draft"))
    next = <Link href={`/p/${id}/upload`} className="btn sm" onClick={(e) => e.stopPropagation()}><Icon name="upload" size="xs" />Upload V{p.version + 1}</Link>;
  else if (role === "client" && status.key === "review") next = <span className="t2">Review V{p.version}</span>;
  else if (role === "client") next = <span className="muted">Waiting for the editor</span>;
  else next = <span className="muted">Client is reviewing V{p.version}</span>;

  return (
    <tr className="rowlink" onClick={() => router.push(href)}>
      <td>
        <Link href={href} className="t-title" style={{ textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>{projectTitle(id, meta)}</Link>
        <div className="t-sub">{role === "editor" ? "Client" : "Editor"}: {otherName ? `${otherName} · ` : ""}<span className="addr">{shortAddress(other)}</span></div>
      </td>
      <td><Status color={status.color}>{status.label}</Status></td>
      <td>{next}</td>
      <td><span className="row"><RevisionMeter free={p.freeRevisions} used={p.revisionsUsed} /><span className="muted">{p.revisionsUsed} used · {p.freeRevisions} free</span></span></td>
      <td className="r num">{usd(p.price)}</td>
      <td className="r num">{usd(earned(p))}</td>
      <td className="faint"><Icon name="chev" size="sm" /></td>
    </tr>
  );
}
