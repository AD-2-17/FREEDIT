"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Hash } from "viem";
import { useConnection } from "wagmi";
import { AppBar } from "@/components/app-bar";
import { FileCheck } from "@/components/file-check";
import { Icon } from "@/components/icon";
import { CopyButton, CopyLinkButton, Notice, RevisionMeter, Status, Steps, TxLink, type Step } from "@/components/ui";
import { useActivity, type ActivityItem } from "@/lib/activity";
import { dateTime, shortAddress, shortHash, usd } from "@/lib/format";
import { DownloadFinal } from "@/components/download-final";
import { useSignIn } from "@/lib/api";
import { importMetaFromUrl, projectTitle, shareLink, useLocalNote, useNotes, useProjectMeta } from "@/lib/meta";
import { network } from "@/lib/network";
import {
  earned, freeditAddress, nextRevisionCost, paidRevisions, parseId, statusOf, useProject, useVersions,
  type Project, type Version,
} from "@/lib/project";
import { readFailure, revertName } from "@/lib/tx";
import { ChangesSheet, PaySheet } from "./sheets";

export function ProjectView({ idText }: { idText: string }) {
  const id = parseId(idText);
  const { address } = useConnection();
  const project = useProject(id);
  const p = project.data as Project | undefined;
  const versions = useVersions(id, p?.version ?? 0);
  const meta = useProjectMeta(id);
  const { signIn, signedIn, storage } = useSignIn();
  const notes = useNotes(id, signedIn);
  const activity = useActivity(id, p ? { versions: p.version, revisions: p.revisionsUsed, paid: p.paid } : undefined);
  const [view, setView] = useState<number>();
  const [sheet, setSheet] = useState<"pay" | "changes" | null>(null);
  const [paidTx, setPaidTx] = useState<Hash>();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  // Opened from a share link: keep the title and names it carries (display only; money facts come from the chain).
  useEffect(() => { if (id) importMetaFromUrl(id); }, [id]);

  const title = id ? projectTitle(id, meta) : "Project";
  const crumbs = [{ label: "Projects", href: "/dashboard" }, { label: title }];

  if (!freeditAddress) return <Frame crumbs={crumbs}><Notice tone="warn">Freedit isn&apos;t deployed on {network.label} yet.</Notice></Frame>;
  if (!id) return <Frame crumbs={crumbs}><Notice tone="bad">That isn&apos;t a valid project number.</Notice></Frame>;
  if (project.isLoading) return <Frame crumbs={crumbs}><div className="skeleton" style={{ height: 420 }} /></Frame>;
  if (project.error || !p) {
    const unknown = revertName(project.error) === "UnknownProject";
    return (
      <Frame crumbs={crumbs}>
        <Notice tone="bad">
          {unknown ? `Project #${id} doesn't exist on ${network.label}.` : <>Couldn&apos;t load this project from {network.label}. Retrying every 15 seconds; check your connection or reload.{project.error && <span className="muted" style={{ display: "block", fontSize: 12, marginTop: 4 }}>{readFailure(project.error)}</span>}</>}
        </Notice>
      </Frame>
    );
  }

  const me = address?.toLowerCase();
  const role: "editor" | "client" | "viewer" = me === p.editor.toLowerCase() ? "editor" : me === p.client.toLowerCase() ? "client" : "viewer";
  const status = statusOf(p);
  const editorName = meta.editorName || shortAddress(p.editor);
  const clientName = meta.clientName || shortAddress(p.client);
  const vs = (versions.data ?? []).map((r) => r.result as Version | undefined);
  const current = Math.min(view ?? p.version, p.version);
  // The project itself carries the latest preview, so the newest version still plays if the per-version read fails.
  const shown = current > 0 ? vs[current - 1] ?? (current === p.version ? { fileHash: p.latestFileHash, submittedAt: 0n, previewURI: p.previewURI } : undefined) : undefined;
  const onLatest = current === p.version;
  const items = activity.data ?? [];
  const paidItem = items.find((a) => a.kind === "paid");
  const paymentTx = paidItem?.txHash ?? paidTx;

  const steps: Step[] =
    status.key === "draft" ? [{ label: "Created", state: "done" }, { label: "Versions", state: "now" }, { label: "Approve & pay", state: "todo" }, { label: "Download", state: "todo", lock: true }]
    : status.key === "paid" ? [{ label: "Created", state: "done" }, { label: "Versions", state: "done" }, { label: "Paid", state: "done" }, { label: "Download", state: "now" }]
    : [{ label: "Created", state: "done" }, { label: "Versions", state: "done" }, { label: "Approve & pay", state: "now" }, { label: "Download", state: "todo", lock: true }];

  const message = (() => {
    if (status.key === "paid") return role === "editor" ? [`Paid. ${usd(p.price)} arrived in your wallet.`, "The client can now download the final file."] : ["Paid. The final file is unlocked.", "Download it on the right. Your browser checks it matches the version that was approved."];
    if (status.key === "draft") return role === "editor" ? ["Upload V1 so your client can review it.", "Two files: a watermarked preview and the full-quality file."] : ["The editor hasn't uploaded a version yet.", "This page updates when V1 arrives."];
    if (status.key === "changes") return role === "editor" ? [`${clientName} asked for changes on V${p.version}.`, `Upload V${p.version + 1} when it's ready.`] : [`Changes requested on V${p.version}.`, "The editor's next version will appear here."];
    return role === "client" ? [`V${p.version} is ready for your review.`, "Watch it, then approve & pay or ask for changes."] : [`Waiting for ${clientName} to review V${p.version}.`, "They can approve & pay or ask for changes."];
  })();

  const refresh = () => { project.refetch(); activity.refetch(); };

  return (
    <div className="shell">
      <AppBar crumbs={crumbs}>
        {p.version > 0 && (
          <span className="seg" role="group" aria-label="Version">
            {Array.from({ length: p.version }, (_, i) => i + 1).slice(-6).map((v) => (
              <button key={v} type="button" aria-pressed={v === current} onClick={() => setView(v)}>V{v}</button>
            ))}
          </span>
        )}
      </AppBar>

      <main className="review">
        <section className="review-main">
          <div className="banner">
            <Steps steps={steps} />
            <div className="hr" />
            <div><b>{message[0]}</b><span className="muted" style={{ fontSize: 13 }}>{message[1]}</span></div>
          </div>

          <Player version={shown} paid={p.paid} watermark={meta.editorName ? `Preview · ${meta.editorName}` : "Preview"} />
          {shown && (
            <div className="between wrap" style={{ marginTop: 10, fontSize: 12.5 }}>
              <span className="muted">V{current}{shown.submittedAt > 0n && <> · {dateTime(shown.submittedAt)}</>}{!onLatest && <span className="warn"> · not the latest version</span>}</span>
              <span className="row muted">Fingerprint <span className="mono">{shortHash(shown.fileHash)}</span><CopyButton value={shown.fileHash} label="Copy fingerprint" /></span>
            </div>
          )}

          <div className="over" style={{ margin: "26px 0 4px" }}>Activity · recorded on Arc</div>
          <Feed items={items} loading={activity.isLoading} failed={!!activity.error} versions={vs} editorName={editorName} />
        </section>

        <aside className="side">
          {status.key === "paid" ? (
            <PaidPanel id={id} p={p} role={role} editorName={editorName} paymentTx={paymentTx} paidAt={paidItem?.timestamp} storage={storage} />
          ) : role === "client" ? (
            <div className="side-sec" style={{ display: "grid", gap: 12 }}>
              <div className="between"><span className="over">Price</span><span className="strong num" style={{ fontSize: 15 }}>{usd(p.price)} <span className="muted" style={{ fontWeight: 500, fontSize: 12.5 }}>USDC</span></span></div>
              {p.version === 0 ? (
                <Notice>Nothing to review yet. You&apos;ll approve and pay here once the editor uploads V1.</Notice>
              ) : (
                <>
                  {!onLatest && <Notice tone="warn">You&apos;re viewing V{current}. Switch to V{p.version} to approve it.</Notice>}
                  <button type="button" className="btn primary lg block" disabled={!onLatest || !shown} onClick={() => setSheet("pay")}>Approve &amp; pay {usd(p.price)}</button>
                  <button type="button" className="btn block" disabled={p.revisionOpen || p.revisionsUsed >= 255} onClick={() => setSheet("changes")}>
                    {p.revisionOpen ? `Changes requested · waiting for V${p.version + 1}` : nextRevisionCost(p) === 0n ? `Request changes · free (${p.freeRevisions - p.revisionsUsed} left)` : `Request changes · ${usd(nextRevisionCost(p))}`}
                  </button>
                  {shown && <div className="help" style={{ justifyContent: "center", margin: 0 }}>You&apos;re approving V{current} · fingerprint <span className="mono">{shortHash(shown.fileHash)}</span></div>}
                </>
              )}
            </div>
          ) : role === "editor" ? (
            <>
              <div className="side-sec" style={{ display: "grid", gap: 12 }}>
                <div className="over">Your project</div>
                <Link href={`/p/${id}/upload`} className={`btn lg block ${status.key === "review" ? "" : "primary"}`}><Icon name="upload" size="sm" />Upload V{p.version + 1}</Link>
                {status.key === "review" && <div className="help" style={{ margin: 0 }}>The client is reviewing V{p.version}. A new version replaces it.</div>}
              </div>
              <div className="side-sec" style={{ display: "grid", gap: 10 }}>
                <div className="over">Share with your client</div>
                <div className="t2" style={{ fontSize: 13, lineHeight: 1.5 }}>
                  It&apos;s already on {meta.clientName || "your client"}&apos;s dashboard: when they connect <span className="addr">{shortAddress(p.client)}</span> on Freedit, they see it.
                  This link takes them straight here{meta.title || meta.clientName || meta.editorName ? ", with the title and names" : ""}.
                </div>
                <div className="field mono" style={{ background: "var(--sunken)", fontSize: 12 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{origin ? shareLink(origin, id, meta) : `/p/${id}`}</span>
                </div>
                <CopyLinkButton value={origin ? shareLink(origin, id, meta) : ""} label="Copy link for your client" />
              </div>
            </>
          ) : (
            <div className="side-sec" style={{ display: "grid", gap: 12 }}>
              <div className="between"><span className="over">Price</span><span className="strong num">{usd(p.price)} USDC</span></div>
              <Notice>{address ? "This wallet isn't part of this project." : "Connect the client's wallet to approve and pay."} Editor <span className="addr">{shortAddress(p.editor)}</span> · client <span className="addr">{shortAddress(p.client)}</span>.</Notice>
            </div>
          )}

          <div className="side-sec" style={{ display: "grid", gap: 10 }}>
            <div className="between" style={{ fontSize: 13 }}>
              <span className="over">Revisions</span>
              <span className="row"><RevisionMeter free={p.freeRevisions} used={p.revisionsUsed} /><span className="t2">{Math.min(p.revisionsUsed, p.freeRevisions)} of {p.freeRevisions} free used{paidRevisions(p) ? ` · ${paidRevisions(p)} paid` : ""}</span></span>
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              {p.paid ? `Done. ${paidRevisions(p)} paid revision${paidRevisions(p) === 1 ? "" : "s"} at ${usd(p.revisionFee)}.`
                : nextRevisionCost(p) === 0n ? `The next change request is free. After the free ones, each costs ${usd(p.revisionFee)}.`
                : <>Free revisions are used. The next change request costs <b style={{ color: "var(--text)" }}>{usd(p.revisionFee)}</b>, paid directly to {role === "editor" ? "you" : editorName}.</>}
            </div>
          </div>

          <ChangeRequests items={items} notes={notes.notes} needsSignIn={notes.needsSignIn} isParty={role !== "viewer"}
            onSignIn={() => signIn().then(() => notes.refetch()).catch(() => {})} />

          <div className="side-sec">
            <dl className="kv" style={{ gridTemplateColumns: "110px 1fr", fontSize: 12.5 }}>
              <dt>Status</dt><dd><Status color={status.color}>{status.label}</Status></dd>
              <dt>Editor</dt><dd className="row" style={{ gap: 6 }}>{meta.editorName && `${meta.editorName} · `}<span className="addr">{shortAddress(p.editor)}</span><CopyButton value={p.editor} /></dd>
              <dt>Client</dt><dd className="row" style={{ gap: 6 }}>{meta.clientName && `${meta.clientName} · `}<span className="addr">{shortAddress(p.client)}</span><CopyButton value={p.client} /></dd>
              <dt>Terms</dt><dd>{usd(p.price)} · {p.freeRevisions} free · {usd(p.revisionFee)} after</dd>
              {role === "editor" && <><dt>Earned</dt><dd className="num strong">{usd(earned(p))}</dd></>}
            </dl>
          </div>
        </aside>
      </main>

      {sheet === "pay" && address && shown && (
        <PaySheet id={id} p={p} account={address} approvedHash={shown.fileHash} editorName={editorName}
          onClose={() => setSheet(null)} onPaid={(h) => { setPaidTx(h); setSheet(null); refresh(); }} />
      )}
      {sheet === "changes" && address && (
        <ChangesSheet id={id} p={p} account={address} editorName={editorName}
          onClose={() => setSheet(null)} onDone={() => { setSheet(null); refresh(); }} />
      )}
    </div>
  );
}

function Frame({ crumbs, children }: { crumbs: { label: string; href?: string }[]; children: React.ReactNode }) {
  return (
    <div className="shell">
      <AppBar crumbs={crumbs} />
      <main className="container page">{children}</main>
    </div>
  );
}

function Player({ version, paid, watermark }: { version?: Version; paid: boolean; watermark: string }) {
  const uri = version?.previewURI ?? "";
  const playable = /^https?:\/\//i.test(uri);
  return (
    <div className="player">
      {playable ? (
        <video key={uri} src={uri} controls preload="metadata" playsInline />
      ) : (
        <div className="empty-player">
          <Icon name="film" size="lg" />
          {version ? "This version's preview link isn't a playable web address." : "No version uploaded yet."}
        </div>
      )}
      {playable && <div className={`wm ${paid ? "gone" : ""}`}>{watermark}</div>}
    </div>
  );
}

function Feed({ items, loading, failed, versions, editorName }: { items: ActivityItem[]; loading: boolean; failed: boolean; versions: (Version | undefined)[]; editorName: string }) {
  if (loading) return <div style={{ display: "grid", gap: 8, marginTop: 8 }}>{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 30 }} />)}</div>;
  if (failed || items.length === 0) {
    // Fallback from contract state: versions with their timestamps, no transaction links.
    const vs = versions.map((v, i) => v && { v, n: i + 1 }).filter(Boolean).reverse() as { v: Version; n: number }[];
    return (
      <div className="feed">
        {failed && <div className="muted" style={{ fontSize: 12.5 }}>Transaction links couldn&apos;t load from the explorer. Showing what the contract stores.</div>}
        {vs.map(({ v, n }) => (
          <div key={n}><span>V{n} submitted <span className="muted">· fingerprint <span className="mono">{shortHash(v.fileHash)}</span></span></span><span className="when">{dateTime(v.submittedAt)}</span></div>
        ))}
        {vs.length === 0 && !failed && <div className="muted">Nothing yet.</div>}
      </div>
    );
  }
  return (
    <div className="feed">
      {[...items].reverse().map((a) => (
        <div key={`${a.txHash}-${a.logIndex}`}>
          <span>{describe(a, editorName)}</span>
          <span className="when">{a.timestamp ? dateTime(a.timestamp) : `block ${a.blockNumber}`} <TxLink hash={a.txHash} label="tx" /></span>
        </div>
      ))}
    </div>
  );
}

function describe(a: ActivityItem, editorName: string) {
  switch (a.kind) {
    case "created": return <>Project created <span className="muted">· {usd(a.price)} · {a.freeRevisions} free · {usd(a.revisionFee)} after</span></>;
    case "version": return <>V{a.version} submitted <span className="muted">· fingerprint <span className="mono">{shortHash(a.fileHash)}</span></span></>;
    case "revision": return <>Revision {a.n} requested <span className="muted">· {a.paidFee > 0n ? `${usd(a.paidFee)} paid to ${editorName}` : "free"}</span></>;
    case "paid": return <>Paid {usd(a.amount)} <span className="muted">· V{a.version} approved</span></>;
  }
}

function ChangeRequests({ items, notes, needsSignIn, onSignIn, isParty }: {
  items: ActivityItem[]; notes: Map<string, string>; needsSignIn: boolean; onSignIn: () => void; isParty: boolean;
}) {
  const requests = items.filter((a): a is ActivityItem & { kind: "revision" } => a.kind === "revision").reverse().slice(0, 4);
  if (requests.length === 0) return null;
  return (
    <div className="side-sec" style={{ display: "grid", gap: 12 }}>
      <div className="between">
        <span className="over">Change requests</span>
        {needsSignIn && isParty && <button type="button" className="link" style={{ fontSize: 12.5 }} onClick={onSignIn}>Sign in to read notes</button>}
      </div>
      {requests.map((r) => <RequestNote key={r.txHash} r={r} text={notes.get(r.noteHash.toLowerCase())} />)}
    </div>
  );
}

function RequestNote({ r, text }: { r: ActivityItem & { kind: "revision" }; text?: string }) {
  const local = useLocalNote(r.noteHash);
  const note = text ?? local;
  return (
    <div className="cm">
      <div className="row" style={{ fontSize: 12.5 }}><b style={{ fontWeight: 500 }}>On V{r.version}</b><span className="muted">· revision {r.n}{r.paidFee > 0n ? ` · ${usd(r.paidFee)}` : " · free"}</span></div>
      <p>{note ?? <span className="muted">Only the editor and the client can read this note. On Arc it&apos;s just a fingerprint: <span className="mono">{shortHash(r.noteHash)}</span>.</span>}</p>
    </div>
  );
}

function PaidPanel({ id, p, role, editorName, paymentTx, paidAt, storage }: { id: bigint; p: Project; role: string; editorName: string; paymentTx?: Hash; paidAt?: number; storage: boolean }) {
  return (
    <div className="side-sec" style={{ display: "grid", gap: 16 }}>
      <div className="success">
        <span className="okring"><Icon name="check" /></span>
        <div><div className="strong">Paid {usd(p.price)} USDC to {role === "editor" ? "you" : editorName}</div><div className="muted" style={{ fontSize: 12.5 }}>{paidAt ? dateTime(paidAt) : "Confirmed on Arc"}</div></div>
      </div>
      {(role === "client" || role === "editor") && storage && <DownloadFinal id={id} expected={p.latestFileHash} />}
      {role === "client" && !storage && (
        <div className="help" style={{ margin: 0, justifyContent: "center", textAlign: "center" }}>File downloads aren&apos;t switched on for this site yet. Ask the editor to send the file, then check it below.</div>
      )}
      <FileCheck expected={p.latestFileHash} label="Check the file you received" />
      <div className="card" style={{ padding: 14 }}>
        <div className="over" style={{ marginBottom: 10 }}>Receipt</div>
        <dl className="kv" style={{ gridTemplateColumns: "112px 1fr", fontSize: 12.5 }}>
          <dt>Price</dt><dd className="num">{usd(p.price)} USDC</dd>
          <dt>Revisions paid</dt><dd className="num">{usd(BigInt(paidRevisions(p)) * p.revisionFee)} USDC ({paidRevisions(p)})</dd>
          <dt>Total to editor</dt><dd className="num strong">{usd(earned(p))} USDC</dd>
          <dt>From</dt><dd className="addr">{shortAddress(p.client)}</dd>
          <dt>To</dt><dd className="addr">{shortAddress(p.editor)}</dd>
          <dt>Version</dt><dd>V{p.version}</dd>
          {paymentTx && <><dt>Transaction</dt><dd><TxLink hash={paymentTx} /></dd></>}
        </dl>
        {paymentTx && (
          <div className="row" style={{ marginTop: 12, fontSize: 13 }}>
            <Link className="link" href={`/r/${paymentTx}`}><Icon name="receipt" size="xs" />Open public receipt</Link>
          </div>
        )}
      </div>
    </div>
  );
}
