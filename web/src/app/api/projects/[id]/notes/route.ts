import { keccak256, toBytes } from "viem";
import { db } from "@/server/db";
import { cleanText, fail, guard, json, readJson } from "@/server/http";

/** Change-request notes: readable by the project's editor and client only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard((await params).id, "party");
  if (!g.ok) return g.res;
  const { data, error } = await db()
    .from("notes")
    .select("note_hash, body, created_at")
    .eq("chain_id", g.net.chain.id)
    .eq("project_id", g.id.toString())
    .order("created_at", { ascending: true });
  if (error) return fail(502, "Couldn't load notes.");
  return json({ notes: (data ?? []).map((n) => ({ noteHash: n.note_hash, body: n.body, createdAt: n.created_at })) });
}

/** The client saves the text of a change request. Its keccak256 is what the contract stored as noteHash. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard((await params).id, "client");
  if (!g.ok) return g.res;
  const text = cleanText((await readJson(req))?.text, 1000);
  if (!text) return fail(400, "The note is empty.");
  const noteHash = keccak256(toBytes(text));
  const { error } = await db()
    .from("notes")
    .upsert(
      { chain_id: g.net.chain.id, note_hash: noteHash, project_id: g.id.toString(), body: text, author: g.me.toLowerCase() },
      { onConflict: "chain_id,note_hash", ignoreDuplicates: true },
    );
  if (error) return fail(502, "Couldn't save the note.");
  return json({ noteHash });
}
