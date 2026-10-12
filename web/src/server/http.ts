import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { chain } from "@/lib/network";
import { parseId } from "@/lib/ids";
import { readProject, type OnchainProject } from "./chain";
import { storageConfigured } from "./env";
import { SESSION_COOKIE, verify, type Session } from "./session";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
export const fail = (status: number, error: string) => json({ error }, status);

/** Display text from a request body: no control characters, trimmed, capped. Empty → null. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
  return v || null;
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  // JSON only: a cross-site HTML form can't send this content type without a CORS preflight.
  if (!req.headers.get("content-type")?.includes("application/json")) return null;
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function currentSession(): Promise<Session | null> {
  const s = verify<Session>((await cookies()).get(SESSION_COOKIE)?.value);
  return s && s.c === chain.id ? s : null;
}

type Role = "editor" | "client" | "party";
type Guarded = { ok: true; id: bigint; project: OnchainProject; me: Session["a"]; role: "editor" | "client" } | { ok: false; res: NextResponse };

/**
 * The checks every project route makes, in order: storage set up, valid id, signed in, project exists on Arc,
 * and the signed-in wallet is the editor / the client / either, according to the contract.
 */
export async function guard(idText: string, need: Role): Promise<Guarded> {
  if (!storageConfigured()) return { ok: false, res: fail(503, "File storage isn't set up on this server yet.") };
  const id = parseId(idText);
  if (!id) return { ok: false, res: fail(400, "That isn't a valid project number.") };
  const session = await currentSession();
  if (!session) return { ok: false, res: fail(401, "Sign in with your wallet first.") };
  let project: OnchainProject | null;
  try {
    project = await readProject(id);
  } catch {
    return { ok: false, res: fail(502, "Couldn't read the project from Arc. Try again.") };
  }
  if (!project) return { ok: false, res: fail(404, "This project doesn't exist on this network.") };
  const me = session.a.toLowerCase();
  const role = me === project.editor.toLowerCase() ? "editor" : me === project.client.toLowerCase() ? "client" : null;
  if (!role || (need !== "party" && need !== role)) {
    const who = need === "editor" ? "the editor" : need === "client" ? "the client" : "the editor or the client";
    return { ok: false, res: fail(403, `Only ${who} of this project can do this.`) };
  }
  return { ok: true, id, project, me: session.a, role };
}
