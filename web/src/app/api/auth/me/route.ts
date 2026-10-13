import { storageConfigured } from "@/server/env";
import { currentSession, json } from "@/server/http";
import { requestNet } from "@/server/net";

/** Who is signed in on this browser for the requested network (if anyone), and whether file storage is available. */
export async function GET() {
  const session = await currentSession(await requestNet());
  return json({ address: session?.a ?? null, storage: storageConfigured() });
}
