import { cookies } from "next/headers";
import { generateSiweNonce } from "viem/siwe";
import { sessionConfigured } from "@/server/env";
import { fail, json } from "@/server/http";
import { cookieOptions, NONCE_COOKIE, NONCE_TTL, sign } from "@/server/session";

/** Step 1 of Sign-In with Ethereum: a single-use nonce, remembered in a signed httpOnly cookie for 10 minutes. */
export async function GET() {
  if (!sessionConfigured()) return fail(503, "Sign-in isn't set up on this server yet.");
  const nonce = generateSiweNonce();
  (await cookies()).set(NONCE_COOKIE, sign({ n: nonce }, NONCE_TTL), cookieOptions(NONCE_TTL));
  return json({ nonce });
}
