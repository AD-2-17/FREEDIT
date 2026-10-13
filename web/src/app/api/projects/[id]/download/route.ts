import { db, FINALS } from "@/server/db";
import { fail, guard, json } from "@/server/http";

/**
 * The paid file. Checks, in order: signed in as the client (or the editor), the contract says paid, and a stored
 * final file has the exact fingerprint the client approved on Arc. Returns a link that works for 60 seconds.
 * The browser then fingerprints the download again before saving it (promise 2).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard((await params).id, "party");
  if (!g.ok) return g.res;
  if (!g.project.paid) return fail(402, "The final file unlocks after the client pays.");

  const { data: rows, error } = await db()
    .from("files")
    .select("path, file_name")
    .eq("chain_id", g.net.chain.id)
    .eq("project_id", g.id.toString())
    .eq("kind", "final")
    .eq("sha256", g.project.latestFileHash.toLowerCase())
    .order("id", { ascending: false })
    .limit(5);
  if (error) return fail(502, "Couldn't look up the file. Try again.");

  // Newest first; skip any upload that was started but never finished (signing fails for a missing object).
  for (const row of rows ?? []) {
    const signed = await db().storage.from(FINALS).createSignedUrl(row.path, 60, { download: row.file_name });
    if (signed.data?.signedUrl) return json({ url: signed.data.signedUrl, fileName: row.file_name });
  }
  return fail(404, "The editor hasn't uploaded the approved file here. Ask them to send it, then check it below.");
}
