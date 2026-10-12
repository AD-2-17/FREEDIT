"use client";

import { useState } from "react";
import type { Hex } from "viem";
import { api, getBlob, saveBlob, useSignIn } from "@/lib/api";
import { shortHash } from "@/lib/format";
import { fingerprintFile } from "@/lib/hash";
import { explainError } from "@/lib/tx";
import { Icon } from "./icon";
import { Notice, Spinner } from "./ui";

type Phase = { step: "idle" } | { step: "signing" } | { step: "downloading"; done: number } | { step: "checking"; done: number }
  | { step: "ok"; name: string } | { step: "mismatch"; got: Hex; blob: Blob; name: string };

/**
 * Download → fingerprint → save. The server releases a 60-second link only after the contract says "paid";
 * the browser then re-computes SHA-256 and saves the file only if it matches the approved fingerprint on Arc.
 */
export function DownloadFinal({ id, expected }: { id: bigint; expected: Hex }) {
  const { signIn } = useSignIn();
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [error, setError] = useState<string>();

  async function run() {
    setError(undefined);
    try {
      setPhase({ step: "signing" });
      await signIn();
      const { url, fileName } = await api<{ url: string; fileName: string }>(`/api/projects/${id}/download`, {});
      setPhase({ step: "downloading", done: 0 });
      const blob = await getBlob(url, (done) => setPhase({ step: "downloading", done }));
      setPhase({ step: "checking", done: 0 });
      const got = await fingerprintFile(blob, (done) => setPhase({ step: "checking", done }));
      if (got.toLowerCase() === expected.toLowerCase()) {
        saveBlob(blob, fileName);
        setPhase({ step: "ok", name: fileName });
      } else {
        setPhase({ step: "mismatch", got, blob, name: fileName });
      }
    } catch (e) {
      setError(explainError(e));
      setPhase({ step: "idle" });
    }
  }

  const busy = phase.step === "signing" || phase.step === "downloading" || phase.step === "checking";
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <button type="button" className="btn primary lg block" onClick={run} disabled={busy}>
        {phase.step === "signing" ? <><Spinner />Sign in with your wallet…</>
          : phase.step === "downloading" ? <><Spinner />Downloading… {Math.round(phase.done * 100)}%</>
          : phase.step === "checking" ? <><Spinner />Checking the fingerprint… {Math.round(phase.done * 100)}%</>
          : <><Icon name="download" size="sm" />{phase.step === "ok" ? "Download again" : "Download final file"}</>}
      </button>
      {phase.step === "ok" && <Notice tone="ok">Saved {phase.name}. It matches the fingerprint the client approved on Arc.</Notice>}
      {phase.step === "mismatch" && (
        <Notice tone="bad">
          The downloaded file has fingerprint {shortHash(phase.got)}, not the approved {shortHash(expected)}. It wasn&apos;t saved.
          Ask the editor about it.{" "}
          <button type="button" className="link" onClick={() => saveBlob(phase.blob, phase.name)}>Save it anyway</button>
        </Notice>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
      {phase.step === "idle" && !error && (
        <div className="help" style={{ margin: 0, justifyContent: "center", textAlign: "center" }}>
          Your wallet asks you to sign in (free, no transaction). The file is checked before it&apos;s saved.
        </div>
      )}
    </div>
  );
}
