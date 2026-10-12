"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BaseError, UserRejectedRequestError } from "viem";
import { createSiweMessage } from "viem/siwe";
import { useConfig, useConnection } from "wagmi";
import { signMessage } from "wagmi/actions";
import { chain } from "./network";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** JSON call to our own API routes. Errors carry the server's plain-English message. */
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

/** A sign-in that failed for any reason except the user cancelling, so the error message can name the step. */
export class SignInError extends Error {
  constructor(public cause: unknown) {
    super("Sign-in failed.");
  }
}

export type Me = { address: string | null; storage: boolean };
const meQuery = { queryKey: ["me", chain.id], queryFn: () => api<Me>("/api/auth/me") };

export function useMe() {
  return useQuery({ ...meQuery, staleTime: 60_000 });
}

/**
 * `signIn()` asks the wallet to sign a Sign-In with Ethereum message (free, no transaction), unless this browser
 * is already signed in as the connected wallet. The server then knows which wallet is calling, for 7 days.
 */
export function useSignIn() {
  const config = useConfig();
  const { address } = useConnection();
  const qc = useQueryClient();
  const me = useMe();
  const signedIn = !!address && me.data?.address?.toLowerCase() === address.toLowerCase();

  async function signIn() {
    if (!address) throw new Error("Connect your wallet first.");
    try {
      const current = await qc.fetchQuery({ ...meQuery, staleTime: 0 });
      if (current.address?.toLowerCase() === address.toLowerCase()) return;
      const { nonce } = await api<{ nonce: string }>("/api/auth/nonce");
      const message = createSiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to Freedit. This is free: it proves you own this wallet and sends no transaction.",
        uri: window.location.origin,
        version: "1",
        chainId: chain.id,
        nonce,
        issuedAt: new Date(),
        expirationTime: new Date(Date.now() + 10 * 60 * 1000),
      });
      const signature = await signMessage(config, { account: address, message });
      await api("/api/auth/verify", { message, signature });
      await qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      if (e instanceof BaseError && e.walk((x) => x instanceof UserRejectedRequestError)) throw e;
      throw new SignInError(e);
    }
  }

  return { signIn, signedIn, storage: me.data?.storage ?? false, ready: !me.isLoading };
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}

/** Uploads a file to a Supabase signed upload URL (same request shape as supabase-js), reporting 0…1 progress. */
export function putFile(url: string, file: Blob, onProgress?: (done: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`The upload failed (${xhr.status}). Try again.`)));
    xhr.onerror = () => reject(new Error("The upload failed. Check your connection and try again."));
    xhr.send(form);
  });
}

/** Downloads into memory (≤ 50 MB) so the browser can fingerprint the file before saving it. */
export function getBlob(url: string, onProgress?: (done: number) => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.responseType = "blob";
    xhr.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.response as Blob) : reject(new Error(`The download failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("The download failed. Check your connection and try again."));
    xhr.send();
  });
}

/** Hands a blob to the browser's normal "save file". */
export function saveBlob(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
