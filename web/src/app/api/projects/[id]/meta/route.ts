import { db } from "@/server/db";
import { cleanText, fail, guard, json, readJson } from "@/server/http";

/** The editor sets the project's title and display names. Only the on-chain editor can. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard((await params).id, "editor");
  if (!g.ok) return g.res;
  const body = await readJson(req);
  if (!body) return fail(400, "Bad request.");
  const row = {
    chain_id: g.net.chain.id,
    project_id: g.id.toString(),
    title: cleanText(body.title, 80),
    editor_name: cleanText(body.editorName, 60),
    client_name: cleanText(body.clientName, 60),
    updated_at: new Date().toISOString(),
  };
  const { error } = await db().from("project_meta").upsert(row, { onConflict: "chain_id,project_id" });
  if (error) return fail(502, "Couldn't save the labels.");
  return json({ ok: true });
}
