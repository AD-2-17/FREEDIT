# Freedit web app

Next.js 16 (App Router, Turbopack) + wagmi 3 + viem, talking to the Freedit contract on Arc.

## Run it (Windows PowerShell or WSL, from this folder)

```bash
npm install
npm run dev                      # http://localhost:3000, Arc Testnet
```

Other networks: `node scripts/dev.mjs local 3000` (dev fork) or `node scripts/dev.mjs mainnet 3000`.

## Local fork with test wallets (no real funds)

In WSL, start a local copy of Arc Testnet with Arc's precompiles:

```bash
arc-anvil --fork-url https://rpc.testnet.arc.io --network arc --port 8545
```

Then `node scripts/dev.mjs local 3000`. "Connect wallet" offers two test wallets (anvil accounts #2 and #3, each with $10,000 test USDC); the first acts as the editor, the second as the client.

## Checks

```bash
npm run typecheck
npm run build
```

## Where things live

| Path | What |
|---|---|
| `src/lib/network.ts` | Arc networks, contract address per network, explorer links |
| `src/lib/abi/freedit.ts` | ABI generated from `contracts/out` with `npm run abi` |
| `src/lib/project.ts` | Contract reads, status and "earned" maths |
| `src/lib/activity.ts` | Event history via the explorer's log API (RPC caps log queries at 10,000 blocks) |
| `src/lib/tx.ts` | Writes: simulate, Arc-safe fees, exact USDC approvals, plain-English errors |
| `src/lib/hash.ts` | Chunked SHA-256 of files in the browser |
| `src/lib/meta.ts` | Titles, client names and notes; this browser only until Phase 4 (Supabase) |
