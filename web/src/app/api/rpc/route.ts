import { decodeFunctionData, isHex, multicall3Abi, type Address } from "viem";
import { chain, network, networkName, rpcUrls, USDC } from "@/lib/network";
import { json } from "@/server/http";

/**
 * Same-origin, read-only relay to Arc's RPC. The browser reads Arc directly and uses this only when it can't
 * (an extension or network blocking *.arc.io showed up as "Failed to fetch" on 10-12). It relays just the reads
 * Freedit makes, against Freedit and USDC only, so it isn't a general-purpose RPC.
 */
const READS = new Set([
  "eth_chainId", "net_version", "eth_blockNumber", "eth_call", "eth_estimateGas", "eth_getBlockByNumber",
  "eth_gasPrice", "eth_maxPriorityFeePerGas", "eth_feeHistory", "eth_getTransactionReceipt", "eth_getTransactionByHash",
]);
const MAX_BODY = 32_000;
const MAX_BATCH = 20;
const MAX_CALLS = 100;

const targets = new Set([network.freedit, USDC].filter((a): a is Address => !!a).map((a) => a.toLowerCase()));
const multicall = chain.contracts?.multicall3?.address.toLowerCase();

/** A call to Freedit or USDC, or a Multicall3 aggregate3 whose every inner call is. */
function allowedCall(tx: unknown): boolean {
  if (!tx || typeof tx !== "object") return false;
  const { to, data, input } = tx as { to?: unknown; data?: unknown; input?: unknown };
  if (typeof to !== "string") return false;
  if (targets.has(to.toLowerCase())) return true;
  const calldata = data ?? input;
  if (to.toLowerCase() !== multicall || !isHex(calldata)) return false;
  try {
    const { functionName, args } = decodeFunctionData({ abi: multicall3Abi, data: calldata });
    if (functionName !== "aggregate3") return false;
    const [calls] = args as readonly [readonly { target: Address }[]];
    return calls.length <= MAX_CALLS && calls.every((c) => targets.has(c.target.toLowerCase()));
  } catch {
    return false;
  }
}

function allowed(req: unknown): boolean {
  if (!req || typeof req !== "object") return false;
  const { method, params } = req as { method?: unknown; params?: unknown };
  if (typeof method !== "string") return false;
  // The local fork has no explorer, so its activity feed reads logs over RPC.
  if (!READS.has(method) && !(networkName === "local" && method === "eth_getLogs")) return false;
  if (method === "eth_call" || method === "eth_estimateGas") {
    // [tx, block] only: no state overrides.
    return Array.isArray(params) && params.length <= 2 && allowedCall(params[0]);
  }
  return true;
}

const rpcError = (id: unknown, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code: -32601, message } });

export async function POST(req: Request) {
  // Browsers say where a request comes from: only this site's own pages may use the relay.
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return json(rpcError(null, "Cross-site requests aren't relayed."), 403);
  if (!req.headers.get("content-type")?.includes("application/json")) return json(rpcError(null, "Send JSON."), 415);

  const body = await req.text();
  if (body.length > MAX_BODY) return json(rpcError(null, "Request too large."), 413);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return json(rpcError(null, "Invalid JSON."), 400);
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  if (items.length === 0 || items.length > MAX_BATCH) return json(rpcError(null, "Batch too large."), 400);
  const refused = items.find((r) => !allowed(r));
  if (refused) return json(rpcError((refused as { id?: unknown })?.id, "Only Freedit's own reads are relayed."), 400);

  // Arc's RPC first, then the docs' other node providers. Upstream JSON (including revert data) passes through.
  for (const url of rpcUrls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) return new Response(await res.text(), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
    } catch {
      // try the next provider
    }
  }
  return json(rpcError(null, `Couldn't reach ${network.label}.`), 502);
}
