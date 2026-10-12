// Sets up a project on the LOCAL arc-anvil fork for access-control.mjs, using anvil's public test wallets (no value).
// Needs: arc-anvil --fork-url https://rpc.testnet.arc.io --network arc --port 8545, and `node scripts/dev.mjs local 3000`.
//   node scripts/security/fork-project.mjs create   → new project (editor anvil #2, client #3), real final upload, V1
//   node scripts/security/fork-project.mjs pay <id> → client approves USDC and pays
// The fork shares chain id 5042002 with testnet, so delete the Supabase rows and files for that id afterwards.
import { createHash } from "node:crypto";
import { createPublicClient, createWalletClient, decodeEventLog, erc20Abi, http, parseAbi, parseGwei } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";

const BASE = "http://localhost:3000";
const RPC = "http://127.0.0.1:8545";
const FREEDIT = "0xC82aB1b65866b43A0F3794ba6d5EAC0a55df4895";
const USDC = "0x3600000000000000000000000000000000000000";
const chain = { id: 5042002, name: "Arc fork", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const abi = parseAbi([
  "function createProject(address client, uint256 price, uint8 freeRevisions, uint256 revisionFee) returns (uint256)",
  "function submitVersion(uint256 id, bytes32 fileHash, string previewURI)",
  "function approveAndPay(uint256 id, bytes32 approvedFileHash)",
  "function getProject(uint256 id) view returns ((address editor, uint8 freeRevisions, uint8 revisionsUsed, uint16 version, bool paid, bool revisionOpen, address client, uint256 price, uint256 revisionFee, bytes32 latestFileHash, string previewURI))",
  "event ProjectCreated(uint256 indexed id, address indexed editor, address indexed client, uint256 price, uint8 freeRevisions, uint256 revisionFee)",
]);
const anvil = (i) => mnemonicToAccount("test test test test test test test test test test test junk", { addressIndex: i });
const editor = anvil(2);
const client = anvil(3);
const pub = createPublicClient({ chain, transport: http(RPC) });
const fees = { maxFeePerGas: parseGwei("50"), maxPriorityFeePerGas: parseGwei("1") };
const send = async (account, req) => {
  const hash = await createWalletClient({ account, chain, transport: http(RPC) }).writeContract({ ...req, ...fees });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${req.functionName} failed`);
  return receipt;
};
const cookieOf = (res, name) => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith(name + "="));

async function login(acct) {
  const r1 = await fetch(`${BASE}/api/auth/nonce`);
  const { nonce } = await r1.json();
  const message = createSiweMessage({ domain: "localhost:3000", address: acct.address, uri: BASE, version: "1", chainId: chain.id, nonce, issuedAt: new Date(), expirationTime: new Date(Date.now() + 600_000) });
  const r2 = await fetch(`${BASE}/api/auth/verify`, { method: "POST", headers: { "content-type": "application/json", cookie: cookieOf(r1, "fd_nonce") }, body: JSON.stringify({ message, signature: await acct.signMessage({ message }) }) });
  return cookieOf(r2, "fd_session");
}

const [step, idArg] = process.argv.slice(2);
if (step === "create") {
  const receipt = await send(editor, { address: FREEDIT, abi, functionName: "createProject", args: [client.address, 5_000_000n, 1, 1_000_000n] });
  const ev = receipt.logs.map((l) => { try { return decodeEventLog({ abi, ...l }); } catch { return null; } }).find((e) => e?.eventName === "ProjectCreated");
  const id = ev.args.id;
  // A real (tiny) final file through the app's own upload route, so "download after paying" has something to sign.
  const file = Buffer.from(`freedit security test file for project ${id} ${Date.now()}`);
  const sha256 = "0x" + createHash("sha256").update(file).digest("hex");
  const cookie = await login(editor);
  const up = await fetch(`${BASE}/api/projects/${id}/upload`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ kind: "final", fileName: "test.txt", size: file.length, contentType: "text/plain", sha256 }) }).then((r) => r.json());
  const form = new FormData();
  form.append("cacheControl", "3600");
  form.append("", new Blob([file]));
  const put = await fetch(up.uploadUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: form });
  if (!put.ok) throw new Error(`upload failed: ${put.status}`);
  await send(editor, { address: FREEDIT, abi, functionName: "submitVersion", args: [id, sha256, "https://example.com/preview.mp4"] });
  console.log(`project ${id} ready (V1 ${sha256.slice(0, 10)}…, final uploaded)`);
} else if (step === "pay" && idArg) {
  const id = BigInt(idArg);
  const p = await pub.readContract({ address: FREEDIT, abi, functionName: "getProject", args: [id] });
  await send(client, { address: USDC, abi: erc20Abi, functionName: "approve", args: [FREEDIT, p.price] });
  await send(client, { address: FREEDIT, abi, functionName: "approveAndPay", args: [id, p.latestFileHash] });
  console.log(`project ${id} paid`);
} else {
  console.log("usage: fork-project.mjs create | pay <id>");
}
