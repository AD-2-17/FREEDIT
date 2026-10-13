// Attack-style tests for Freedit's Sign-In with Ethereum routes. Uses anvil's public test keys (no value).
import { mnemonicToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
// Anvil's public test wallets (no value), derived from its well-known test phrase. Run against `npm run dev`.
const anvil = (i) => mnemonicToAccount("test test test test test test test test test test test junk", { addressIndex: i });

const BASE = "http://localhost:3000";
const alice = anvil(2); // anvil #2
const mallory = anvil(3); // anvil #3

const cookieOf = (res, name) => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith(name + "="));

async function nonce() {
  const res = await fetch(`${BASE}/api/auth/nonce`);
  return { nonce: (await res.json()).nonce, cookie: cookieOf(res, "fd_nonce") };
}

function message(address, n, over = {}) {
  return createSiweMessage({
    domain: "localhost:3000", address, statement: "Sign in to Freedit.", uri: BASE, version: "1",
    chainId: 5042002, nonce: n, issuedAt: new Date(), expirationTime: new Date(Date.now() + 600_000), ...over,
  });
}

async function verify(msg, signature, cookie, headers = {}) {
  const res = await fetch(`${BASE}/api/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...headers },
    body: JSON.stringify({ message: msg, signature }),
  });
  return { status: res.status, body: await res.json(), session: cookieOf(res, "fd_session_5042002") };
}

async function me(cookie) {
  return (await fetch(`${BASE}/api/auth/me`, { headers: cookie ? { cookie } : {} })).json();
}

const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);

// 1. Happy path
let n = await nonce();
let msg = message(alice.address, n.nonce);
let sig = await alice.signMessage({ message: msg });
let r = await verify(msg, sig, n.cookie);
const session = r.session;
check("valid sign-in sets a session", r.status === 200 && !!session, `status ${r.status}`);
const who = await me(session);
check("session identifies the signer", who.address?.toLowerCase() === alice.address.toLowerCase(), who.address);

// 2. Replay the same signed message with a fresh nonce cookie
n = await nonce();
r = await verify(msg, sig, n.cookie);
check("replayed message is rejected", r.status !== 200, `status ${r.status}: ${r.body.error}`);

// 3. Message signed for another domain
n = await nonce();
msg = message(alice.address, n.nonce, { domain: "evil.example" });
sig = await alice.signMessage({ message: msg });
r = await verify(msg, sig, n.cookie);
check("other domain is rejected", r.status !== 200, `status ${r.status}`);

// 4. Same, plus a forged X-Forwarded-Host
n = await nonce();
msg = message(alice.address, n.nonce, { domain: "evil.example" });
sig = await alice.signMessage({ message: msg });
r = await verify(msg, sig, n.cookie, { "x-forwarded-host": "evil.example" });
check("forged x-forwarded-host doesn't help", r.status !== 200, `status ${r.status}`);

// 5. Wrong chain
n = await nonce();
msg = message(alice.address, n.nonce, { chainId: 1 });
sig = await alice.signMessage({ message: msg });
r = await verify(msg, sig, n.cookie);
check("other chain is rejected", r.status !== 200, `status ${r.status}`);

// 6. Mallory signs a message claiming to be Alice
n = await nonce();
msg = message(alice.address, n.nonce);
sig = await mallory.signMessage({ message: msg });
r = await verify(msg, sig, n.cookie);
check("signature from another wallet is rejected", r.status !== 200, `status ${r.status}`);

// 7. No nonce cookie at all
n = await nonce();
msg = message(alice.address, n.nonce);
sig = await alice.signMessage({ message: msg });
r = await verify(msg, sig, undefined);
check("missing nonce cookie is rejected", r.status !== 200, `status ${r.status}`);

// 8. Nonce cookie reused after a successful sign-in
n = await nonce();
msg = message(alice.address, n.nonce);
sig = await alice.signMessage({ message: msg });
r = await verify(msg, sig, n.cookie);
const again = await verify(msg, sig, n.cookie);
check("nonce works once only", r.status === 200 && again.status !== 200, `first ${r.status}, second ${again.status}`);

// 9. Tampered session cookie (address swapped, old signature kept)
const [, value] = session.split("=");
const [payload, mac] = value.split(".");
const forged = JSON.parse(Buffer.from(payload, "base64url").toString());
forged.a = mallory.address.toLowerCase();
const tampered = `fd_session_5042002=${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${mac}`;
check("tampered session cookie is ignored", (await me(tampered)).address === null);

// 10. Expired message
n = await nonce();
msg = message(alice.address, n.nonce, { issuedAt: new Date(Date.now() - 3_600_000), expirationTime: new Date(Date.now() - 60_000) });
sig = await alice.signMessage({ message: msg });
r = await verify(msg, sig, n.cookie);
check("expired message is rejected", r.status !== 200, `status ${r.status}`);

console.log(results.join("\n"));
console.log(results.every((l) => l.startsWith("PASS")) ? "\nALL PASS" : "\nSOME FAILED");
