import { cookies } from "next/headers";
import { isHex } from "viem";
import { parseSiweMessage, verifySiweMessage } from "viem/siwe";
import { publicClientFor } from "@/server/chain";
import { sessionConfigured } from "@/server/env";
import { fail, json, readJson } from "@/server/http";
import { netForChainId } from "@/server/net";
import { consumeNonce, cookieOptions, NONCE_COOKIE, sessionCookie, SESSION_TTL, sign, verify } from "@/server/session";

/**
 * Step 2 of Sign-In with Ethereum: check the signed EIP-4361 message (this site's domain, our nonce,
 * Arc's chain id, not expired, valid signature incl. smart wallets via ERC-6492), then set a 7-day session.
 */
export async function POST(req: Request) {
  if (!sessionConfigured()) return fail(503, "Sign-in isn't set up on this server yet.");
  const body = await readJson(req);
  const message = typeof body?.message === "string" ? body.message : "";
  const signature = body?.signature;
  if (!message || message.length > 2000 || !isHex(signature)) return fail(400, "Bad sign-in request.");

  const jar = await cookies();
  const nonce = verify<{ n: string }>(jar.get(NONCE_COOKIE)?.value)?.n;
  jar.delete(NONCE_COOKIE); // single use, whatever happens next
  if (!nonce) return fail(400, "The sign-in request expired. Try again.");

  const fields = parseSiweMessage(message);
  // The message names its Arc network; the session is for that network only.
  const net = netForChainId(fields.chainId);
  if (!net || !fields.address) return fail(400, "Sign in on the network this site uses.");

  // The Host the request actually arrived on. Never x-forwarded-host: a caller can set that header, which would
  // let a phishing site replay a signature made for its own domain here.
  const host = req.headers.get("host") ?? "";
  const valid = await verifySiweMessage(publicClientFor(net), { message, signature, domain: host, nonce, time: new Date() }).catch(() => false);
  if (!valid) return fail(401, "That signature doesn't match. Try signing in again.");
  if (!(await consumeNonce(nonce))) return fail(400, "That sign-in request was already used. Try again.");

  jar.set(sessionCookie(net.chain.id), sign({ a: fields.address.toLowerCase(), c: net.chain.id }, SESSION_TTL), cookieOptions(SESSION_TTL));
  return json({ address: fields.address });
}
