import { formatUnits, parseUnits } from "viem";
import { USDC_DECIMALS } from "./network";

/** 15000000n → "$15.00". Amounts are USDC ERC-20 units (6 decimals), never the 18-decimal native balance. */
export function usd(units: bigint): string {
  const negative = units < 0n;
  const [whole, frac = ""] = formatUnits(negative ? -units : units, USDC_DECIMALS).split(".");
  const cents = (frac + "00").slice(0, 2);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${grouped}.${cents}`;
}

/** "15" or "15.5" → 15500000n. Throws on more than 6 decimals or junk, so callers can show a field error. */
export function parseUsd(input: string): bigint {
  const clean = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{0,6})?$/.test(clean)) throw new Error("Enter an amount like 15 or 15.00");
  return parseUnits(clean, USDC_DECIMALS);
}

export function shortAddress(address?: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortHash(hash?: string): string {
  if (!hash) return "";
  return `${hash.slice(2, 6)}…${hash.slice(-4)}`;
}

/** 64 hex chars in groups of four, the way the upload page shows a fingerprint. */
export function groupedHash(hash: string): string {
  return hash.replace(/^0x/, "").match(/.{1,4}/g)?.join(" ") ?? hash;
}

/** Two characters for an avatar: initials for a name, the first two hex digits for an address. */
export function avatarText(nameOrAddress: string): string {
  return /^0x/i.test(nameOrAddress) ? nameOrAddress.slice(2, 4).toUpperCase() : initials(nameOrAddress);
}

export function initials(name?: string): string {
  if (!name) return "··";
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}

export function dateTime(seconds: bigint | number): string {
  const d = new Date(Number(seconds) * 1000);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(seconds: bigint | number): string {
  const diff = Date.now() / 1000 - Number(seconds);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return new Date(Number(seconds) * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
