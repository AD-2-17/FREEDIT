import { storageConfigured } from "@/server/env";
import { currentSession, json } from "@/server/http";

/** Who is signed in on this browser (if anyone), and whether file storage is available on this server. */
export async function GET() {
  const session = await currentSession();
  return json({ address: session?.a ?? null, storage: storageConfigured() });
}
