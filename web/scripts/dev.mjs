// Starts `next dev` for a given Arc network without needing cross-env (works on Windows and WSL).
// Usage: node scripts/dev.mjs [testnet|local|mainnet] [port]
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [network = "testnet", port = "3000"] = process.argv.slice(2);
const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const next = resolve(web, "node_modules/next/dist/bin/next");

const child = spawn(process.execPath, [next, "dev", "-p", port], {
  cwd: web,
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_ARC_NETWORK: network },
});
child.on("exit", (code) => process.exit(code ?? 0));
