"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Mark } from "./icon";
import { NetworkSwitch } from "./network-switch";
import { ThemeToggle } from "./theme";
import { WalletButton } from "./wallet";

export type Crumb = { label: ReactNode; href?: string };

/** Top bar for the app pages: logo, breadcrumbs, network switch, theme switch, wallet. */
export function AppBar({ crumbs = [], children }: { crumbs?: Crumb[]; children?: ReactNode }) {
  return (
    <header className="appbar">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/" className="brand"><Mark />Freedit</Link>
        {crumbs.map((c, i) => (
          <span key={i} className={`row ${i < crumbs.length - 1 ? "crumb-mid" : ""}`} style={{ gap: 10, minWidth: 0 }}>
            <span className="sep">/</span>
            {c.href ? <Link href={c.href}>{c.label}</Link> : <span className="here">{c.label}</span>}
          </span>
        ))}
      </nav>
      <div className="row g12">
        {children}
        <NetworkSwitch />
        <ThemeToggle />
        <WalletButton />
      </div>
    </header>
  );
}
