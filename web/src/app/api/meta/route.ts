import { chain } from "@/lib/network";
import { db } from "@/server/db";
import { storageConfigured } from "@/server/env";
import { fail, json } from "@/server/http";

/** Public labels (title, names) for up to 50 projects: GET /api/meta?ids=1,2,3 */
export async function GET(req: Request) {
  if (!storageConfigured()) return json({ meta: {} });
  const raw = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = [...new Set(raw.split(",").filter((s) => /^\d{1,18}$/.test(s) && s !== "0"))].slice(0, 50);
  if (ids.length === 0) return json({ meta: {} });
  const { data, error } = await db()
    .from("project_meta")
    .select("project_id, title, editor_name, client_name")
    .eq("chain_id", chain.id)
    .in("project_id", ids);
  if (error) return fail(502, "Couldn't load project labels.");
  const meta: Record<string, { title?: string; editorName?: string; clientName?: string }> = {};
  for (const r of data ?? []) {
    meta[String(r.project_id)] = { title: r.title ?? undefined, editorName: r.editor_name ?? undefined, clientName: r.client_name ?? undefined };
  }
  return json({ meta });
}
