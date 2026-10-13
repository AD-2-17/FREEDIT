// Who-can-do-what checks against the local app (anvil public test keys; no value). Usage: node access-test.mjs <projectId> <phase>
import { mnemonicToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
// Anvil's public test wallets (no value), derived from its well-known test phrase. Run against `npm run dev`.
const anvil = (i) => mnemonicToAccount("test test test test test test test test test test test junk", { addressIndex: i });
const BASE = "http://localhost:3000";
const [id = "2", phase = "unpaid"] = process.argv.slice(2);

const wallets = {
  editor: anvil(2),
  client: anvil(3),
  stranger: anvil(4),
};
const cookieOf = (res, name) => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith(name + "="));

async function login(acct) {
  const r1 = await fetch(`${BASE}/api/auth/nonce`);
  const { nonce } = await r1.json();
  const message = createSiweMessage({ domain: "localhost:3000", address: acct.address, uri: BASE, version: "1", chainId: 5042002, nonce, issuedAt: new Date(), expirationTime: new Date(Date.now() + 600_000) });
  const r2 = await fetch(`${BASE}/api/auth/verify`, { method: "POST", headers: { "content-type": "application/json", cookie: cookieOf(r1, "fd_nonce") }, body: JSON.stringify({ message, signature: await acct.signMessage({ message }) }) });
  return cookieOf(r2, "fd_session_5042002");
}

const call = async (cookie, method, path, body) => {
  const res = await fetch(`${BASE}${path}`, { method, headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, msg: j.error ?? (j.url ? "signed url" : j.notes ? `${j.notes.length} notes` : j.uploadUrl ? "upload url" : "ok") };
};

const s = {};
for (const [k, a] of Object.entries(wallets)) s[k] = await login(a);
const fin = { kind: "final", fileName: "x.mp4", size: 1000, contentType: "video/mp4", sha256: "0x" + "ab".repeat(32) };
const rows = [];
const expect = (who, what, r, want) => rows.push(`${r.status === want ? "PASS" : "FAIL"}  ${who.padEnd(8)} ${what.padEnd(26)} → ${r.status} (want ${want}) ${r.msg}`);

expect("stranger", "download", await call(s.stranger, "POST", `/api/projects/${id}/download`, {}), 403);
expect("stranger", "upload", await call(s.stranger, "POST", `/api/projects/${id}/upload`, fin), 403);
expect("stranger", "read notes", await call(s.stranger, "GET", `/api/projects/${id}/notes`), 403);
expect("stranger", "edit labels", await call(s.stranger, "POST", `/api/projects/${id}/meta`, { title: "hacked" }), 403);
expect("client", "upload", await call(s.client, "POST", `/api/projects/${id}/upload`, fin), 403);
expect("client", "edit labels", await call(s.client, "POST", `/api/projects/${id}/meta`, { title: "hacked" }), 403);
expect("editor", "write a note", await call(s.editor, "POST", `/api/projects/${id}/notes`, { text: "fake" }), 403);
expect("editor", "read notes", await call(s.editor, "GET", `/api/projects/${id}/notes`), 200);
if (phase === "unpaid") {
  expect("client", "download before paying", await call(s.client, "POST", `/api/projects/${id}/download`, {}), 402);
  expect("editor", "download before paid", await call(s.editor, "POST", `/api/projects/${id}/download`, {}), 402);
} else {
  expect("client", "download after paying", await call(s.client, "POST", `/api/projects/${id}/download`, {}), 200);
  expect("editor", "upload after paid", await call(s.editor, "POST", `/api/projects/${id}/upload`, fin), 409);
}
console.log(rows.join("\n"));
console.log(rows.every((r) => r.startsWith("PASS")) ? "ALL PASS" : "SOME FAILED");
