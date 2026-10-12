import { randomBytes } from "node:crypto";
import { chain } from "@/lib/network";
import { db, FINALS, MAX_FILE_BYTES, PREVIEWS } from "@/server/db";
import { cleanText, fail, guard, json, readJson } from "@/server/http";

const PREVIEW_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

/**
 * The editor asks for a one-time upload link for the next version's preview or final file.
 * Files go straight from the browser to Supabase Storage; this server never handles the video bytes.
 * Refused once the project is paid, so the delivered file can't be swapped afterwards.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard((await params).id, "editor");
  if (!g.ok) return g.res;
  if (g.project.paid) return fail(409, "This project is paid, so its files are locked.");

  const body = await readJson(req);
  const kind = body?.kind === "preview" || body?.kind === "final" ? body.kind : null;
  const size = typeof body?.size === "number" ? body.size : 0;
  const fileName = cleanText(body?.fileName, 200) ?? "file";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const sha256 = typeof body?.sha256 === "string" ? body.sha256.toLowerCase() : null;
  if (!kind) return fail(400, "Say whether this is the preview or the final file.");
  if (size <= 0 || size > MAX_FILE_BYTES) return fail(413, "Files can be up to 50 MB.");
  if (kind === "preview" && !PREVIEW_TYPES.includes(contentType)) return fail(415, "The preview must be an MP4, MOV or WebM video.");
  if (kind === "final" && !(sha256 && /^0x[0-9a-f]{64}$/.test(sha256))) return fail(400, "The final file's fingerprint is missing.");

  const version = g.project.version + 1;
  const safe = fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "file";
  const path = `${chain.id}/${g.id}/v${version}-${randomBytes(6).toString("hex")}-${safe}`;
  const bucket = kind === "preview" ? PREVIEWS : FINALS;

  const signed = await db().storage.from(bucket).createSignedUploadUrl(path);
  if (signed.error || !signed.data) return fail(502, "Couldn't prepare the upload. Try again.");

  const { error } = await db().from("files").insert({
    chain_id: chain.id,
    project_id: g.id.toString(),
    version,
    kind,
    path,
    file_name: fileName,
    sha256: kind === "final" ? sha256 : null,
    size,
  });
  if (error) return fail(502, "Couldn't record the upload. Try again.");

  return json({
    uploadUrl: signed.data.signedUrl,
    publicUrl: kind === "preview" ? db().storage.from(PREVIEWS).getPublicUrl(path).data.publicUrl : undefined,
    version,
  });
}
