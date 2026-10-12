import { cookies } from "next/headers";
import { json } from "@/server/http";
import { SESSION_COOKIE } from "@/server/session";

export async function POST() {
  (await cookies()).delete(SESSION_COOKIE);
  return json({ ok: true });
}
