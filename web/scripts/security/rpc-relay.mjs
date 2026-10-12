// Allow/refuse checks for the read-only RPC relay (/api/rpc). Usage: node rpc-relay.mjs [baseUrl] [local]
// "local" when the app runs against the arc-anvil fork (eth_getLogs is allowed there, for the activity feed).
import { encodeFunctionData, multicall3Abi, parseAbi } from "viem";

const [BASE = "http://localhost:3000", mode] = process.argv.slice(2);
const F = "0xC82aB1b65866b43A0F3794ba6d5EAC0a55df4895";
const USDC = "0x3600000000000000000000000000000000000000";
const MC = "0xcA11bde05977b3631167028862bE2a173976CA11";
const OTHER = "0x0000000000000000000000000000000000001234";
const fd = parseAbi(["function projectCount() view returns (uint256)", "function getProject(uint256)"]);
const erc = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const count = encodeFunctionData({ abi: fd, functionName: "projectCount" });
const agg = (calls) => encodeFunctionData({ abi: multicall3Abi, functionName: "aggregate3", args: [calls.map(([target, callData]) => ({ target, allowFailure: true, callData }))] });
const call = (to, data, extra = []) => ({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest", ...extra] });
const rpc = (method, params = []) => ({ jsonrpc: "2.0", id: 1, method, params });

const rows = [];
async function expect(name, body, want, headers = {}) {
  const res = await fetch(`${BASE}/api/rpc`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const text = await res.text();
  rows.push(`${res.status === want ? "PASS" : "FAIL"}  ${name.padEnd(36)} → ${res.status} (want ${want}) ${text.slice(0, 70)}`);
}

await expect("chain id", rpc("eth_chainId"), 200);
await expect("Freedit read", call(F, count), 200);
await expect("revert data passes through", call(F, encodeFunctionData({ abi: fd, functionName: "getProject", args: [999n] })), 200);
await expect("multicall of Freedit + USDC", call(MC, agg([[F, count], [USDC, encodeFunctionData({ abi: erc, functionName: "balanceOf", args: [F] })]])), 200);
await expect("batch of 2", [rpc("eth_blockNumber"), call(F, count)], 200);
await expect("multicall with another contract", call(MC, agg([[F, count], [OTHER, "0x"]])), 400);
await expect("eth_call to another contract", call(OTHER, "0x"), 400);
await expect("state override", call(F, count, [{}]), 400);
await expect("eth_sendRawTransaction", rpc("eth_sendRawTransaction", ["0x00"]), 400);
await expect("eth_getLogs", rpc("eth_getLogs", [{ address: F, fromBlock: "latest" }]), mode === "local" ? 200 : 400);
await expect("cross-site browser request", rpc("eth_chainId"), 403, { "sec-fetch-site": "cross-site" });
await expect("batch of 21", Array.from({ length: 21 }, () => rpc("eth_chainId")), 400);

console.log(rows.join("\n"));
console.log(rows.every((r) => r.startsWith("PASS")) ? "ALL PASS" : "SOME FAILED");
