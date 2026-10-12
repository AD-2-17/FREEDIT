"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Hex } from "viem";
import { useConfig, useConnection } from "wagmi";
import { AppBar } from "@/components/app-bar";
import { Icon } from "@/components/icon";
import { Notice, Spinner, Steps } from "@/components/ui";
import { useActivity } from "@/lib/activity";
import { groupedHash, usd } from "@/lib/format";
import { fingerprintFile } from "@/lib/hash";
import { projectTitle, useNote, useProjectMeta } from "@/lib/meta";
import { chain, network, networkName } from "@/lib/network";
import { parseId, useProject, type Project } from "@/lib/project";
import { explainError, sendFreedit } from "@/lib/tx";

const MAX_BYTES = 50 * 1024 * 1024; // Supabase free plan limit (D11); stated up front instead of failing later

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export function UploadVersion({ idText }: { idText: string }) {
  const id = parseId(idText);
  const router = useRouter();
  const config = useConfig();
  const { address, chainId } = useConnection();
  const project = useProject(id);
  const p = project.data as Project | undefined;
  const meta = useProjectMeta(id);
  const activity = useActivity(id, p ? { versions: p.version, revisions: p.revisionsUsed, paid: p.paid } : undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File>();
  const [progress, setProgress] = useState<number>();
  const [hash, setHash] = useState<Hex>();
  const [preview, setPreview] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const title = id ? projectTitle(id, meta) : "Project";
  const next = (p?.version ?? 0) + 1;
  const lastRequest = [...(activity.data ?? [])].reverse().find((a) => a.kind === "revision");
  const note = useNote(lastRequest?.kind === "revision" ? lastRequest.noteHash : undefined);

  async function choose(f: File) {
    setError(undefined);
    setHash(undefined);
    setFile(f);
    if (f.size > MAX_BYTES) return setError(`${f.name} is ${sizeLabel(f.size)}. The limit is 50 MB per file for now.`);
    setProgress(0);
    try {
      setHash(await fingerprintFile(f, setProgress));
    } catch {
      setError("Couldn't read that file. Try choosing it again.");
    } finally {
      setProgress(undefined);
    }
  }

  // https only; plain http to localhost is allowed on the local dev fork so test clips can be served locally.
  const previewOk = /^https:\/\/\S+$/i.test(preview.trim()) || (networkName === "local" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/\S*$/i.test(preview.trim()));
  const isEditor = !!p && address?.toLowerCase() === p.editor.toLowerCase();
  const canSubmit = isEditor && chainId === chain.id && !!hash && previewOk && !p?.paid && !busy;

  async function submit() {
    if (!canSubmit || !id || !address || !hash) return;
    setBusy(true);
    setError(undefined);
    try {
      await sendFreedit(config, address, { functionName: "submitVersion", args: [id, hash, preview.trim()] });
      router.push(`/p/${id}`);
    } catch (e) {
      setError(explainError(e));
      setBusy(false);
    }
  }

  const crumbs = [{ label: "Projects", href: "/dashboard" }, { label: title, href: id ? `/p/${id}` : undefined }, { label: `Upload V${next}` }];

  return (
    <div className="shell">
      <AppBar crumbs={crumbs} />
      <main className="container page" style={{ display: "grid", gap: 20 }}>
        {!id || project.error ? (
          <Notice tone="bad">This project doesn&apos;t exist on {network.label}.</Notice>
        ) : !p ? (
          <div className="skeleton" style={{ height: 320 }} />
        ) : p.paid ? (
          <Notice tone="ok">This project is paid, so its delivered file is locked and can&apos;t change. <Link className="link" href={`/p/${id}`}>Back to the project</Link></Notice>
        ) : (
          <>
            <div className="page-head" style={{ margin: 0 }}>
              <div>
                <h1 className="title">Upload V{next}</h1>
                <div className="sub">Two parts: a watermarked preview for the client to watch, and the full-quality file whose fingerprint goes on Arc.</div>
              </div>
              <Steps steps={[
                { label: "Final file", state: hash ? "done" : "now" },
                { label: "Preview", state: previewOk ? "done" : hash ? "now" : "todo" },
                { label: "Record on Arc", state: hash && previewOk ? "now" : "todo" },
              ]} />
            </div>

            {isEditor && p.version === 0 && (
              <Notice tone="ok">
                Project #{id.toString()} is created and already on {meta.clientName || "your client"}&apos;s dashboard. They&apos;ll see V1 as soon as you submit it.
                After that, the project page has a link you can send them.
              </Notice>
            )}

            {!isEditor && <Notice tone="warn">{address ? "Only the editor's wallet can upload versions for this project." : "Connect the editor's wallet (top right) to upload."}</Notice>}

            {p.revisionOpen && lastRequest?.kind === "revision" && (
              <div className="req">
                <span className="pic"><Icon name="msg" /></span>
                <div>
                  <div><b style={{ fontWeight: 600 }}>{meta.clientName || "Your client"} asked for changes on V{p.version}</b>{" "}
                    <span className="muted">· revision {lastRequest.n}{lastRequest.paidFee > 0n ? `, ${usd(lastRequest.paidFee)} paid to you` : ", free"}</span></div>
                  <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", fontSize: 13 }}>{note ?? <span className="muted">The note text appears here once notes sync (next update).</span>}</p>
                </div>
              </div>
            )}

            <div className="grid2">
              <div className="card" style={{ padding: 16 }}>
                <div className="between"><span className="label" style={{ margin: 0 }}>1 · Full-quality file</span><span className="row muted" style={{ fontSize: 12 }}><Icon name="lock" size="xs" />Private until paid</span></div>
                <div className="help" style={{ margin: "2px 0 12px" }}>Your browser fingerprints it. The file itself isn&apos;t uploaded in this version of the app.</div>
                {file && !error ? (
                  <div className="file">
                    <span className="fileic"><Icon name="film" /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="strong" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{sizeLabel(file.size)} · {progress !== undefined ? `fingerprinting ${Math.round(progress * 100)}%` : hash ? "fingerprinted" : ""}</div>
                    </div>
                    {hash ? <Icon name="check" className="ok" /> : <button type="button" className="link" onClick={() => fileInput.current?.click()}>Change</button>}
                  </div>
                ) : (
                  <div
                    className={`drop ${dragOver ? "over" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInput.current?.click()}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) choose(f); }}
                  >
                    <Icon name="upload" size="lg" />
                    <span><b style={{ color: "var(--text)", fontWeight: 500 }}>Choose the final export</b> or drop it here</span>
                    <span style={{ fontSize: 12 }}>Up to 50 MB</span>
                  </div>
                )}
                {(progress !== undefined || hash) && <div className="bar"><i style={{ width: `${(progress ?? 1) * 100}%` }} /></div>}
                {file && hash && <button type="button" className="link" style={{ marginTop: 10, fontSize: 12.5 }} onClick={() => fileInput.current?.click()}>Choose a different file</button>}
                <input ref={fileInput} type="file" accept="video/*,.mov,.mp4,.mxf,.zip" hidden onChange={(e) => e.target.files?.[0] && choose(e.target.files[0])} />
              </div>

              <div className="card" style={{ padding: 16 }}>
                <div className="between"><span className="label" style={{ margin: 0 }}>2 · Watermarked preview</span><span className="muted" style={{ fontSize: 12 }}>What the client watches</span></div>
                <div className="help" style={{ margin: "2px 0 12px" }}>Paste a direct link to the preview video (.mp4). Next update: upload it here instead.</div>
                <div className={`field ${preview && !previewOk ? "invalid" : ""}`}>
                  <input value={preview} onChange={(e) => setPreview(e.target.value)} placeholder="https://…/preview_v1_watermarked.mp4" spellCheck={false} aria-label="Preview video link" />
                </div>
                <div className={`help ${preview && !previewOk ? "bad" : previewOk ? "ok" : ""}`}>
                  {preview && !previewOk ? "Use a full https:// link." : previewOk ? <><Icon name="check" size="xs" />Link looks good</> : "Export it with your watermark from Premiere, Resolve or Final Cut."}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: "16px 18px" }}>
              <div className="between"><span className="label" style={{ margin: 0 }}>File fingerprint · SHA-256</span>{hash && <span className="row ok" style={{ fontSize: 12.5 }}><Icon name="check" size="xs" />Computed in your browser</span>}</div>
              <div className="hash">{hash ? groupedHash(hash) : <span className="faint">Choose the final file to compute it.</span>}</div>
              <div className="muted" style={{ fontSize: 13 }}>A unique code for this exact file: change one frame and the code changes. It&apos;s saved on Arc with V{next}, and after paying, the client checks the file they receive against it.</div>
            </div>

            {error && <Notice tone="bad">{error}</Notice>}

            <div className="actionbar">
              <span className="muted" style={{ fontSize: 12.5 }}>One wallet confirmation · network fee under $0.01.</span>
              <button type="button" className="btn primary lg" onClick={submit} disabled={!canSubmit}>
                {busy ? <><Spinner />Confirm in your wallet…</> : <><Icon name="upload" size="sm" />Submit V{next}</>}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
