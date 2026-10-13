import { createHmac, timingSafeEqual } from "node:crypto";
import type { Address } from "viem";
import { db } from "./db";
import { serverEnv, storageConfigured } from "./env";

/**
 * Tiny signed tokens for httpOnly cookies:
 *   fd_session_<chainId>  { a: wallet address (lowercase), c: chain id, e: expiry }   7 days, after Sign-In with Ethereum
 *   fd_nonce              { n: nonce, e: expiry }                                     10 minutes, one sign-in attempt
 * One session per Arc network, so switching networks never carries a sign-in across (and switching back keeps it).
 * Format: base64url(JSON) + "." + base64url(HMAC-SHA256(SESSION_SECRET, payload)). No database needed.
 */
export const sessionCookie = (chainId: number) => `fd_session_${chainId}`;
/** Cookie names this site has used for sessions, cleared together on sign-out. */
export const SESSION_COOKIES = ["fd_session", sessionCookie(5042), sessionCookie(5042002)];
export const NONCE_COOKIE = "fd_nonce";
export const SESSION_TTL = 7 * 24 * 3600;
export const NONCE_TTL = 10 * 60;

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const mac = (payload: string) => createHmac("sha256", serverEnv.sessionSecret).update(payload).digest("base64url");

export function sign(data: Record<string, unknown>, ttlSeconds: number): string {
  const payload = b64(JSON.stringify({ ...data, e: Math.floor(Date.now() / 1000) + ttlSeconds }));
  return `${payload}.${mac(payload)}`;
}

export function verify<T extends Record<string, unknown>>(token: string | undefined): (T & { e: number }) | null {
  if (!token || !serverEnv.sessionSecret) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(mac(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as T & { e: number };
    return typeof data.e === "number" && data.e > Date.now() / 1000 ? data : null;
  } catch {
    return null;
  }
}

export type Session = { a: Address; c: number };

const usedInMemory = new Map<string, number>();

/**
 * Marks a sign-in nonce as used; false if it already was. With Supabase set up this is a unique row in
 * siwe_nonces, so it holds across all server instances; without it, a per-instance memory fallback.
 */
export async function consumeNonce(nonce: string): Promise<boolean> {
  if (storageConfigured()) {
    const { error } = await db().from("siwe_nonces").insert({ nonce });
    if (error) return false; // duplicate key (already used) or storage error: refuse either way
    // Prune day-old rows (a query builder only runs when awaited; a failure here doesn't matter).
    await db().from("siwe_nonces").delete().lt("used_at", new Date(Date.now() - 86_400_000).toISOString()).then(() => {}, () => {});
    return true;
  }
  const now = Date.now();
  for (const [n, exp] of usedInMemory) if (exp < now) usedInMemory.delete(n);
  if (usedInMemory.has(nonce)) return false;
  usedInMemory.set(nonce, now + NONCE_TTL * 1000);
  return true;
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});
