"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, useMe } from "./api";
import { chain } from "./network";

/**
 * Off-chain labels (project title, display names) and change-request notes.
 * Shared through Supabase when the server has storage set up (Phase 4); this browser's copy is kept as a
 * fallback and for instant display. Nothing here is trusted for money: amounts, parties and fingerprints
 * always come from the contract on Arc.
 */
export type ProjectMeta = { title?: string; clientName?: string; editorName?: string };

const pKey = (id: bigint) => `freedit:${chain.id}:p:${id}`;
const nKey = (hash: string) => `freedit:${chain.id}:note:${hash.toLowerCase()}`;
const EVENT = "freedit-meta";

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // storage blocked: labels just won't persist on this device
  }
}

function useStored<T>(key: string | undefined): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  const load = useCallback(() => setValue(key ? read<T>(key) : undefined), [key]);
  useEffect(() => {
    load();
    window.addEventListener(EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, [load]);
  return value;
}

/** Server labels win where set; this device's copy fills the gaps. */
export function mergeMeta(local: ProjectMeta | undefined, server: ProjectMeta | undefined): ProjectMeta {
  const out: ProjectMeta = { ...local };
  for (const [k, v] of Object.entries(server ?? {})) if (v) out[k as keyof ProjectMeta] = v;
  return out;
}

// ── Labels ──────────────────────────────────────────────────────────────────

export function saveProjectMeta(id: bigint, meta: ProjectMeta) {
  write(pKey(id), { ...read<ProjectMeta>(pKey(id)), ...meta });
}

/** Publish labels for everyone (editor only, signed in). */
export async function pushProjectMeta(id: bigint, meta: ProjectMeta) {
  await api(`/api/projects/${id}/meta`, meta);
}

/** Labels for many projects in one request (dashboard). */
export function useServerMeta(ids: readonly bigint[]) {
  const me = useMe();
  const key = ids.map(String).join(",");
  return useQuery({
    queryKey: ["meta", chain.id, key],
    queryFn: () => api<{ meta: Record<string, ProjectMeta> }>(`/api/meta?ids=${key}`).then((r) => r.meta),
    enabled: ids.length > 0 && !!me.data?.storage,
    staleTime: 30_000,
  });
}

export const useLocalMeta = (id: bigint | undefined) => useStored<ProjectMeta>(id ? pKey(id) : undefined);

export function useProjectMeta(id: bigint | undefined): ProjectMeta {
  const local = useLocalMeta(id);
  const server = useServerMeta(id ? [id] : []);
  const s = id ? server.data?.[id.toString()] : undefined;
  return useMemo(() => mergeMeta(local, s), [local, s]);
}

/** Title to show when no label is stored. */
export const projectTitle = (id: bigint, meta: ProjectMeta) => meta.title?.trim() || `Project #${id}`;

// ── Notes ───────────────────────────────────────────────────────────────────

export function saveNote(noteHash: string, text: string) {
  write(nKey(noteHash), text);
}

/** Publish a change-request note (client only, signed in). Only its keccak256 is on Arc. */
export async function pushNote(id: bigint, text: string) {
  await api(`/api/projects/${id}/notes`, { text });
}

/**
 * Note texts for one project, keyed by note hash. The server shares them with the editor and the client only,
 * so it needs a signed-in session; `needsSignIn` tells the page to offer "Sign in to read notes".
 */
export function useNotes(id: bigint | undefined, signedIn: boolean) {
  const me = useMe();
  const q = useQuery({
    queryKey: ["notes", chain.id, id?.toString(), me.data?.address],
    queryFn: () => api<{ notes: { noteHash: string; body: string }[] }>(`/api/projects/${id}/notes`).then((r) => r.notes),
    enabled: !!id && signedIn && !!me.data?.storage,
    staleTime: 15_000,
    retry: false,
  });
  const map = useMemo(() => new Map((q.data ?? []).map((n) => [n.noteHash.toLowerCase(), n.body])), [q.data]);
  return { notes: map, needsSignIn: !!me.data?.storage && !signedIn, refetch: q.refetch };
}

export const useLocalNote = (hash: string | undefined) => useStored<string>(hash ? nKey(hash) : undefined);

// ── Share links (labels travel in the link, so they show even before the client signs in) ──

const clean = (s: string | null) => (s ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80) || undefined;
const LINK_KEYS = { t: "title", c: "clientName", e: "editorName" } as const;

export function shareLink(origin: string, id: bigint, meta: ProjectMeta): string {
  const q = new URLSearchParams();
  for (const [k, field] of Object.entries(LINK_KEYS)) {
    const v = meta[field];
    if (v) q.set(k, v);
  }
  const query = q.toString();
  return `${origin}/p/${id}${query ? `?${query}` : ""}`;
}

/** On opening a share link: keep any labels this browser doesn't have yet, then tidy the address bar. */
export function importMetaFromUrl(id: bigint) {
  const params = new URLSearchParams(window.location.search);
  const current = read<ProjectMeta>(pKey(id)) ?? {};
  const incoming: ProjectMeta = {};
  for (const [k, field] of Object.entries(LINK_KEYS)) {
    const v = clean(params.get(k));
    if (v && !current[field]) incoming[field] = v;
  }
  if (Object.keys(incoming).length) saveProjectMeta(id, incoming);
  if ([...params.keys()].some((k) => k in LINK_KEYS)) window.history.replaceState(null, "", window.location.pathname);
}
