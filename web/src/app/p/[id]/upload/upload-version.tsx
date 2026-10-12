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
import { api, putFile, useSignIn } from "@/lib/api";
import { groupedHash, usd } from "@/lib/format";
import { fingerprintFile } from "@/lib/hash";
import { projectTitle, useLocalNote, useNotes, useProjectMeta } from "@/lib/meta";
import { chain, network, networkName } from "@/lib/network";
import { parseId, useProject, type Project } from "@/lib/project";
import { explainError, sendFreedit } from "@/lib/tx";

const MAX_BYTES = 50 * 1024 * 1024; // Supabase free-plan limit (D11); stated up front instead of failing later
const PREVIEW_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

type Phase = "idle" | "signing" | "final" | "preview" | "sending";

/** A file picker with drag-and-drop, shown as a row once a file is chosen. */
function FilePick({ file, status, done, onPick, accept, prompt }: {
  file?: File; status: string; done: boolean; onPick: (f: File) => void; accept: string; prompt: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <>
      {file ? (
        <div className="file">
          <span className="fileic"><Icon name="film" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="strong" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
            <div className="muted" style={{ fontSize: 12 }}>{sizeLabel(file.size)}{status ? ` · ${status}` : ""}</div>
          </div>
          {done ? <Icon name="check" className="ok" /> : null}
          <button type="button" className="link" style={{ fontSize: 12.5 }} onClick={() => input.current?.click()}>Change</button>
        </div>
      ) : (
        <div
          className={`drop ${over ? "over" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onPick(f); }}
        >
          <Icon name="upload" size="lg" />
          <span><b style={{ color: "var(--text)", fontWeight: 500 }}>{prompt}</b> or drop it here</span>
          <span style={{ fontSize: 12 }}>Up to 50 MB</span>
        </div>
      )}
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
    </>
  );
}

export function UploadVersion({ idText }: { idText: string }) {
  const id = parseId(idText);
  const router = useRouter();
  const config = useConfig();
  const { address, chainId } = useConnection();
  const project = useProject(id);
  const p = project.data as Project | undefined;
  const meta = useProjectMeta(id);
  const { signIn, signedIn, storage } = useSignIn();
  const notes = useNotes(id, signedIn);
  const activity = useActivity(id, p ? { versions: p.version, revisions: p.revisionsUsed, paid: p.paid } : undefined);

  const [finalFile, setFinalFile] = useState<File>();
  const [hashing, setHashing] = useState<number>();
  const [hash, setHash] = useState<Hex>();
  const [previewFile, setPreviewFile] = useState<File>();
  const [previewLink, setPreviewLink] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [sent, setSent] = useState({ final: 0, preview: 0 });
  const [error, setError] = useState<string>();

  const title = id ? projectTitle(id, meta) : "Project";
  const next = (p?.version ?? 0) + 1;
  const lastRequest = [...(activity.data ?? [])].reverse().find((a) => a.kind === "revision");
  const requestHash = lastRequest?.kind === "revision" ? lastRequest.noteHash : undefined;
  const localNote = useLocalNote(requestHash);
  const note = (requestHash && notes.notes.get(requestHash.toLowerCase())) || localNote;

  async function chooseFinal(f: File) {
    setError(undefined);
    setHash(undefined);
    setFinalFile(f);
    if (f.size > MAX_BYTES) return setError(`${f.name} is ${sizeLabel(f.size)}. The limit is 50 MB per file for now.`);
    setHashing(0);
    try {
      setHash(await fingerprintFile(f, setHashing));
    } catch {
      setError("Couldn't read that file. Try choosing it again.");
    } finally {
      setHashing(undefined);
    }
  }

  function choosePreview(f: File) {
    setError(undefined);
    setPreviewFile(f);
    if (f.size > MAX_BYTES) setError(`${f.name} is ${sizeLabel(f.size)}. The limit is 50 MB per file for now.`);
    else if (!PREVIEW_TYPES.includes(f.type)) setError("The preview must be an MP4, MOV or WebM video.");
  }

  const previewFileOk = !!previewFile && previewFile.size <= MAX_BYTES && PREVIEW_TYPES.includes(previewFile.type);
  // Without storage: a pasted https link (plain http to localhost is allowed on the local dev fork).
  const previewLinkOk = /^https:\/\/\S+$/i.test(previewLink.trim()) || (networkName === "local" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/\S*$/i.test(previewLink.trim()));
  const previewOk = storage ? previewFileOk : previewLinkOk;
  const finalOk = !!hash && !!finalFile && finalFile.size <= MAX_BYTES;
  const isEditor = !!p && address?.toLowerCase() === p.editor.toLowerCase();
  const busy = phase !== "idle";
  const canSubmit = isEditor && chainId === chain.id && finalOk && previewOk && !p?.paid && !busy;

  async function submit() {
    if (!canSubmit || !id || !address || !hash || !finalFile) return;
    setError(undefined);
    try {
      let previewURI = previewLink.trim();
      if (storage && previewFile) {
        setPhase("signing");
        await signIn();
        // Final file first (private bucket), then the preview (public). Both go straight to Supabase Storage.
        setPhase("final");
        const fin = await api<{ uploadUrl: string }>(`/api/projects/${id}/upload`, {
          kind: "final", fileName: finalFile.name, size: finalFile.size, contentType: finalFile.type, sha256: hash,
        });
        await putFile(fin.uploadUrl, finalFile, (d) => setSent((s) => ({ ...s, final: d })));
        setPhase("preview");
        const pre = await api<{ uploadUrl: string; publicUrl: string }>(`/api/projects/${id}/upload`, {
          kind: "preview", fileName: previewFile.name, size: previewFile.size, contentType: previewFile.type,
        });
        await putFile(pre.uploadUrl, previewFile, (d) => setSent((s) => ({ ...s, preview: d })));
        previewURI = pre.publicUrl;
      }
      setPhase("sending");
      await sendFreedit(config, address, { functionName: "submitVersion", args: [id, hash, previewURI] });
      router.push(`/p/${id}`);
    } catch (e) {
      setError(explainError(e));
      setPhase("idle");
    }
  }

  const crumbs = [{ label: "Projects", href: "/dashboard" }, { label: title, href: id ? `/p/${id}` : undefined }, { label: `Upload V${next}` }];
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const finalStatus = hashing !== undefined ? `fingerprinting ${pct(hashing)}` : phase === "final" ? `uploading ${pct(sent.final)}` : sent.final === 1 ? "uploaded" : hash ? "fingerprinted" : "";
  const previewStatus = phase === "preview" ? `uploading ${pct(sent.preview)}` : sent.preview === 1 ? "uploaded" : previewFileOk ? "ready" : "";

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
                <div className="sub">Two files: the full-quality export, which stays private until the client pays, and a watermarked preview for them to watch.</div>
              </div>
              <Steps steps={[
                { label: "Final file", state: finalOk ? "done" : "now" },
                { label: "Preview", state: previewOk ? "done" : finalOk ? "now" : "todo" },
                { label: "Record on Arc", state: finalOk && previewOk ? "now" : "todo" },
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
                <div style={{ minWidth: 0 }}>
                  <div><b style={{ fontWeight: 600 }}>{meta.clientName || "Your client"} asked for changes on V{p.version}</b>{" "}
                    <span className="muted">· revision {lastRequest.n}{lastRequest.paidFee > 0n ? `, ${usd(lastRequest.paidFee)} paid to you` : ", free"}</span></div>
                  <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", fontSize: 13 }}>
                    {note ?? (notes.needsSignIn
                      ? <button type="button" className="link" onClick={() => signIn().then(() => notes.refetch()).catch(() => {})}>Sign in to read the client&apos;s note</button>
                      : <span className="muted">The client&apos;s note isn&apos;t available.</span>)}
                  </p>
                </div>
              </div>
            )}

            <div className="grid2">
              <div className="card" style={{ padding: 16 }}>
                <div className="between"><span className="label" style={{ margin: 0 }}>1 · Full-quality file</span><span className="row muted" style={{ fontSize: 12 }}><Icon name="lock" size="xs" />Private until paid</span></div>
                <div className="help" style={{ margin: "2px 0 12px" }}>
                  {storage ? "Stored privately. Only the client can download it, and only after paying." : "Your browser fingerprints it. File storage isn't switched on for this site, so send the file to your client yourself after payment."}
                </div>
                <FilePick file={finalFile} status={finalStatus} done={storage ? sent.final === 1 : !!hash} onPick={chooseFinal} accept="video/*,.mov,.mp4,.mxf,.zip" prompt="Choose the final export" />
                {(hashing !== undefined || hash) && <div className="bar"><i style={{ width: `${(phase === "final" ? sent.final : hashing ?? 1) * 100}%` }} /></div>}
              </div>

              <div className="card" style={{ padding: 16 }}>
                <div className="between"><span className="label" style={{ margin: 0 }}>2 · Watermarked preview</span><span className="muted" style={{ fontSize: 12 }}>What the client watches</span></div>
                <div className="help" style={{ margin: "2px 0 12px" }}>Export it with your watermark from Premiere, Resolve or Final Cut. MP4, MOV or WebM.</div>
                {storage ? (
                  <>
                    <FilePick file={previewFile} status={previewStatus} done={sent.preview === 1} onPick={choosePreview} accept="video/mp4,video/quicktime,video/webm" prompt="Choose the preview" />
                    {phase === "preview" || sent.preview > 0 ? <div className="bar"><i style={{ width: `${sent.preview * 100}%` }} /></div> : null}
                  </>
                ) : (
                  <>
                    <div className={`field ${previewLink && !previewLinkOk ? "invalid" : ""}`}>
                      <input value={previewLink} onChange={(e) => setPreviewLink(e.target.value)} placeholder="https://…/preview_v1_watermarked.mp4" spellCheck={false} aria-label="Preview video link" />
                    </div>
                    <div className={`help ${previewLink && !previewLinkOk ? "bad" : previewLinkOk ? "ok" : ""}`}>
                      {previewLink && !previewLinkOk ? "Use a full https:// link." : previewLinkOk ? <><Icon name="check" size="xs" />Link looks good</> : "Paste a direct link to the preview video."}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="card" style={{ padding: "16px 18px" }}>
              <div className="between"><span className="label" style={{ margin: 0 }}>File fingerprint · SHA-256</span>{hash && <span className="row ok" style={{ fontSize: 12.5 }}><Icon name="check" size="xs" />Computed in your browser</span>}</div>
              <div className="hash">{hash ? groupedHash(hash) : <span className="faint">Choose the final file to compute it.</span>}</div>
              <div className="muted" style={{ fontSize: 13 }}>A unique code for this exact file: change one frame and the code changes. It&apos;s saved on Arc with V{next}, and after paying, the client&apos;s browser checks the download against it.</div>
            </div>

            {error && <Notice tone="bad">{error}</Notice>}

            <div className="actionbar">
              <span className="muted" style={{ fontSize: 12.5 }}>
                {storage ? "Your wallet asks you to sign in (free), then confirm once. Network fee under $0.01." : "One wallet confirmation · network fee under $0.01."}
              </span>
              <button type="button" className="btn primary lg" onClick={submit} disabled={!canSubmit}>
                {phase === "signing" ? <><Spinner />Sign in with your wallet…</>
                  : phase === "final" ? <><Spinner />Uploading the final file… {pct(sent.final)}</>
                  : phase === "preview" ? <><Spinner />Uploading the preview… {pct(sent.preview)}</>
                  : phase === "sending" ? <><Spinner />Confirm in your wallet…</>
                  : <><Icon name="upload" size="sm" />Submit V{next}</>}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
