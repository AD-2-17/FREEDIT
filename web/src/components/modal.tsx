"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icon";

/** Centered sheet over a dimmed page. Esc or the × closes it unless `locked` (a wallet step is in progress). */
export function Modal({ title, onClose, locked, children }: { title: string; onClose: () => void; locked?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !locked) onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [onClose, locked]);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="scrim" onClick={() => !locked && onClose()} />
      <div className="sheet" ref={ref} tabIndex={-1}>
        <button type="button" className="iconbtn" style={{ position: "absolute", top: 16, right: 16, border: 0 }} onClick={onClose} disabled={locked} aria-label="Close">
          <Icon name="x" size="sm" />
        </button>
        {children}
      </div>
    </div>
  );
}
