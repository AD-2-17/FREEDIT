import { cookies } from "next/headers";
import { json } from "@/server/http";
import { SESSION_COOKIES } from "@/server/session";

export async function POST() {
  // Disconnecting signs out on every network.
  const jar = await cookies();
  for (const name of SESSION_COOKIES) jar.delete(name);
  return json({ ok: true });
}
