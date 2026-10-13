"use client";

import { useEffect } from "react";
import { network, networkName, rememberNetwork, switchable } from "@/lib/network";

const SYNC_KEY = "freedit:net";

/**
 * Slider between Arc mainnet (real USDC) and Arc Testnet (test money). The choice is remembered in this browser
 * and the page reloads, so every read, sign-in, upload and link follows the new network.
 */
export function NetworkSwitch() {
  // Another tab switched: follow it, so no open tab keeps acting on the other network.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SYNC_KEY && e.newValue && e.newValue !== networkName) window.location.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!switchable) {
    return <span className="net hide-sm"><i className="dot" style={{ ["--c" as string]: "var(--ok)" }} />{network.label}</span>;
  }

  const mainnet = networkName === "mainnet";
  function toggle() {
    const next = mainnet ? "testnet" : "mainnet";
    rememberNetwork(next);
    try {
      localStorage.setItem(SYNC_KEY, next);
    } catch {
      // storage blocked: other tabs just won't follow
    }
    // Drop any ?net= from a shared link, or it would switch straight back.
    const url = new URL(window.location.href);
    url.searchParams.delete("net");
    window.location.replace(url.toString());
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={mainnet}
      aria-label="Arc mainnet"
      className="netswitch"
      onClick={toggle}
      title={mainnet ? "On Arc mainnet (real USDC). Switch to Arc Testnet" : "On Arc Testnet (test money). Switch to Arc mainnet"}
    >
      <span className="ns-label">{mainnet ? "Mainnet" : "Testnet"}</span>
      <span className="ns-track" aria-hidden="true"><span className="ns-thumb" /></span>
    </button>
  );
}
