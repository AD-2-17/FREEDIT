"use client";

import { useState, type ReactNode } from "react";
import { explorerAddress, explorerTx } from "@/lib/network";
import { shortAddress, shortHash, usd } from "@/lib/format";
import { Icon } from "./icon";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    } catch {
      // clipboard blocked: nothing to do, the value is visible on screen
    }
  }
  return (
    <button type="button" className="copy" onClick={copy} aria-label={`${label} ${value}`} title={done ? "Copied" : label}>
      <Icon name={done ? "check" : "copy"} size="xs" className={done ? "ok" : ""} />
    </button>
  );
}

/** 0x1234…abcd with a copy button and, optionally, a link to the explorer. */
export function Address({ address, link = false }: { address: string; link?: boolean }) {
  return (
    <span className="row" style={{ gap: 6, display: "inline-flex" }}>
      {link ? (
        <a className="addr link" href={explorerAddress(address)} target="_blank" rel="noreferrer">{shortAddress(address)}</a>
      ) : (
        <span className="addr">{shortAddress(address)}</span>
      )}
      <CopyButton value={address} label="Copy address" />
    </span>
  );
}

export function TxLink({ hash, label }: { hash: string; label?: string }) {
  return (
    <a className="link mono" href={explorerTx(hash)} target="_blank" rel="noreferrer">
      {label ?? `0x${shortHash(hash)}`} <Icon name="ext" size="xs" />
    </a>
  );
}

export function Usd({ units, suffix = true }: { units: bigint; suffix?: boolean }) {
  return (
    <span className="num">
      {usd(units)}
      {suffix && <span className="muted" style={{ fontWeight: 500 }}> USDC</span>}
    </span>
  );
}

export function Status({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="st">
      <i className="dot" style={{ ["--c" as string]: color }} />
      {children}
    </span>
  );
}

/** Free-revision slots, filled as they're used, plus one amber bar per paid revision (max 6 drawn). */
export function RevisionMeter({ free, used }: { free: number; used: number }) {
  const paid = Math.max(0, used - free);
  const bars = [
    ...Array.from({ length: Math.min(free, 6) }, (_, i) => (i < used ? "on" : "")),
    ...Array.from({ length: Math.min(paid, 6) }, () => "paid"),
  ];
  return (
    <span className="meter" aria-hidden="true">
      {bars.map((c, i) => <i key={i} className={c} />)}
    </span>
  );
}

export type Step = { label: string; state: "done" | "now" | "todo"; lock?: boolean };

export function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li key={s.label} className={s.state === "todo" ? "" : s.state} aria-current={s.state === "now" ? "step" : undefined}>
          <span className="b">
            {s.state === "done" ? <Icon name="check" size="xs" /> : s.lock ? <Icon name="lock" size="xs" /> : i + 1}
          </span>
          {s.label}
        </li>
      ))}
    </ol>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "ok" | "warn" | "bad"; children: ReactNode }) {
  const icon = tone === "ok" ? "check" : tone === "bad" || tone === "warn" ? "alert" : "info";
  return (
    <div className={`notice ${tone === "info" ? "" : tone}`} role={tone === "bad" ? "alert" : "status"}>
      <Icon name={icon} size="sm" className={tone === "info" ? "muted" : tone} />
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function Spinner() {
  return <Icon name="loader" size="sm" className="spin" />;
}
