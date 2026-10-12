"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import { signOut } from "@/lib/api";
import { chain, explorerAddress, network } from "@/lib/network";
import { shortAddress } from "@/lib/format";
import { Icon } from "./icon";
import { CopyButton } from "./ui";

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

/** Connect button, wrong-network switch, or the connected wallet chip with a small menu. */
export function WalletButton() {
  const { address, isConnected, chainId, connector } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  useEffect(() => setMounted(true), []);

  // Prefer named wallets found through EIP-6963 (MetaMask, Rabby…); keep the generic one as a fallback.
  const named = connectors.filter((c) => c.id !== "injected");
  const choices = named.length ? named : connectors;

  if (!mounted) {
    return <button type="button" className="btn" disabled><Icon name="wallet" size="sm" />Connect wallet</button>;
  }

  if (!isConnected || !address) {
    return (
      <div ref={ref} style={{ position: "relative" }}>
        <button
          type="button"
          className="btn"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => (choices.length === 1 ? connect.mutate({ connector: choices[0] }) : setOpen(!open))}
          disabled={connect.isPending}
        >
          <Icon name="wallet" size="sm" />
          {connect.isPending ? "Check your wallet…" : "Connect wallet"}
        </button>
        {open && (
          <div className="menu" role="menu">
            {choices.map((c) => (
              <button key={c.uid} role="menuitem" type="button" onClick={() => { setOpen(false); connect.mutate({ connector: c }); }}>
                {c.icon ? <img src={c.icon} alt="" width={18} height={18} style={{ borderRadius: 4 }} /> : <Icon name="wallet" size="sm" />}
                {c.name}
              </button>
            ))}
            {choices.length === 0 && (
              <a href="https://metamask.io/download" target="_blank" rel="noreferrer" role="menuitem">
                <Icon name="ext" size="sm" />No wallet found. Get MetaMask
              </a>
            )}
          </div>
        )}
        {connect.error && !/reject|denied/i.test(connect.error.message) && (
          <div className="help bad" style={{ position: "absolute", right: 0, top: "100%", whiteSpace: "nowrap" }}>
            {(connect.error as Error).name === "ProviderNotFoundError" ? (
              <span>No browser wallet found. <a className="link" href="https://metamask.io/download" target="_blank" rel="noreferrer">Get MetaMask</a></span>
            ) : "Couldn't connect. Try again."}
          </div>
        )}
      </div>
    );
  }

  if (chainId !== chain.id) {
    return (
      <button type="button" className="btn" onClick={() => switchChain.mutate({ chainId: chain.id })} disabled={switchChain.isPending}>
        <i className="dot" style={{ ["--c" as string]: "var(--warn)" }} />
        {switchChain.isPending ? "Check your wallet…" : `Switch to ${network.label}`}
      </button>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="chip" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="av">{address.slice(2, 4).toUpperCase()}</span>
        <span className="addr" style={{ color: "var(--text)" }}>{shortAddress(address)}</span>
        <Icon name="down" size="xs" className="faint" />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="between" style={{ padding: "8px 10px", fontSize: 12.5 }}>
            <span className="muted">{connector?.name ?? "Wallet"}</span>
            <CopyButton value={address} label="Copy address" />
          </div>
          <div className="mono" style={{ padding: "0 10px 8px", fontSize: 11.5, overflowWrap: "anywhere" }}>{address}</div>
          <a role="menuitem" href={explorerAddress(address)} target="_blank" rel="noreferrer"><Icon name="ext" size="sm" />View on explorer</a>
          <button role="menuitem" type="button" onClick={() => { setOpen(false); disconnect.mutate(); signOut().then(() => qc.invalidateQueries({ queryKey: ["me"] })); }}><Icon name="logout" size="sm" />Disconnect</button>
        </div>
      )}
    </div>
  );
}
