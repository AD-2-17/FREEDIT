"use client";

import { useCallback, useEffect, useState } from "react";
import { chain } from "./network";

/**
 * Off-chain labels: project title, client name, change-request notes.
 * Phase 3 keeps them in this browser only (localStorage). Phase 4 moves them to Supabase so both
 * sides see them. Nothing here is trusted for money: amounts, parties and fingerprints come from the chain.
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
    // storage blocked: labels just won't persist
  }
}

export function saveProjectMeta(id: bigint, meta: ProjectMeta) {
  write(pKey(id), { ...read<ProjectMeta>(pKey(id)), ...meta });
}

export function saveNote(noteHash: string, text: string) {
  write(nKey(noteHash), text);
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

export const useProjectMeta = (id: bigint | undefined) => useStored<ProjectMeta>(id ? pKey(id) : undefined) ?? {};
export const useNote = (hash: string | undefined) => useStored<string>(hash ? nKey(hash) : undefined);

/** Title to show when no label is stored. */
export const projectTitle = (id: bigint, meta: ProjectMeta) => meta.title?.trim() || `Project #${id}`;

/** Display-only text from a link: no control characters, trimmed, capped. */
const clean = (s: string | null) => (s ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80) || undefined;

const LINK_KEYS = { t: "title", c: "clientName", e: "editorName" } as const;

/**
 * Link the editor sends to the client. The project is already on the client's dashboard (the contract
 * indexes it by their wallet); the link goes straight to it and carries the labels so the client sees
 * the title and names too. Phase 4 stores labels in Supabase and the extra parameters become unnecessary.
 */
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
