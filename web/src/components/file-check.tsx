"use client";

import { useRef, useState } from "react";
import type { Hex } from "viem";
import { shortHash } from "@/lib/format";
import { fingerprintFile } from "@/lib/hash";
import { Icon } from "./icon";

/** Fingerprints a file in the browser and compares it with the one recorded on Arc. Nothing is uploaded. */
export function FileCheck({ expected, label = "Check a file" }: { expected: Hex; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string>();
  const [progress, setProgress] = useState<number>();
  const [result, setResult] = useState<Hex>();
  const [error, setError] = useState<string>();

  async function check(file: File) {
    setName(file.name);
    setResult(undefined);
    setError(undefined);
    setProgress(0);
    try {
      setResult(await fingerprintFile(file, setProgress));
    } catch {
      setError("Couldn't read that file.");
    } finally {
      setProgress(undefined);
    }
  }

  const match = result && result.toLowerCase() === expected.toLowerCase();
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row" style={{ fontSize: 13 }}>
        <Icon name="shield" size="sm" className={match ? "ok" : result ? "bad" : "muted"} />
        <b style={{ fontWeight: 500 }}>
          {match ? "File matches the fingerprint on Arc" : result ? "This file doesn't match" : "Fingerprint on Arc"}
        </b>
      </div>
      <div className="mono muted" style={{ marginTop: 6, overflowWrap: "anywhere" }}>{expected}</div>
      {progress !== undefined && (
        <div style={{ marginTop: 10 }}>
          <div className="help" style={{ marginTop: 0 }}>Checking {name}… {Math.round(progress * 100)}%</div>
          <div className="bar"><i style={{ width: `${progress * 100}%` }} /></div>
        </div>
      )}
      {result && !match && (
        <div className="help bad" style={{ display: "block" }}>
          {name} has fingerprint {shortHash(result)}. It isn&apos;t the approved file: don&apos;t use it, and download again or ask the editor.
        </div>
      )}
      {error && <div className="help bad">{error}</div>}
      <input ref={input} type="file" hidden onChange={(e) => e.target.files?.[0] && check(e.target.files[0])} />
      <button type="button" className="link" style={{ marginTop: 10, fontSize: 13 }} onClick={() => input.current?.click()} disabled={progress !== undefined}>
        <Icon name="hash" size="xs" />{result ? "Check another file" : label}
      </button>
    </div>
  );
}
