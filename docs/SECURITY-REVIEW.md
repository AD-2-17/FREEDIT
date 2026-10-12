# Freedit security review (Phase 6)

Self-review before the Arc mainnet deploy, 2026-10-12. Scope: `contracts/src/Freedit.sol`, `contracts/script/Deploy.s.sol`, every API route in `web/src/app/api`, the server helpers in `web/src/server`, Supabase (tables, buckets, RLS), and the mainnet configuration. A self-review, not an audit.

**Verdict: the contract has no findings that block the mainnet deploy.** The web app has one medium finding (W-1). It needs no contract change, so it can be fixed after the deploy and before the live example project.

## What was run

| Check | Result |
|---|---|
| Contract unit + fuzz tests (1,000 runs) | 35/35 pass |
| Invariants (256 runs × 64 calls): zero custody, exact editor income, conservation of USDC | 3/3 pass |
| Arc Testnet fork, real USDC (`network = "arc"`): decimals, full flow, blocklisted editor | 3/3 pass |
| `web/scripts/security/access-control.mjs` (stranger / client / editor, before and after payment) | 20/20 pass |
| `web/scripts/security/siwe-attacks.mjs` (replay, other domain, forged `x-forwarded-host`, other chain, wrong signer, missing or reused nonce, tampered cookie, expired) | 11/11 pass |
| `web/scripts/security/rpc-relay.mjs` (allowed reads, refused writes and other contracts, cross-site, batch size) | 12/12 pass |
| Supabase security advisor | only "RLS enabled, no policy" (INFO, intended: server-only access) |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Live site bundles (66 script files) scanned for the service-role key, session secret and their names | none found |
| Mainnet deploy dry run (`--sender`, no broadcast) | passes: chain 5042, ≈2.0M gas, ≈0.08 USDC worst case at 40 gwei |

The API tests ran against a local arc-anvil fork of Arc Testnet with anvil's public test keys (`web/scripts/security/fork-project.mjs` sets up the project). The Supabase rows and file they created were deleted afterwards.

## Contract

Checked: no custody (every payment is one `safeTransferFrom` client → editor; no `payable`, `receive`, `msg.value` or withdraw), checks-effects-interactions plus `nonReentrant` on both payment paths, access control on every write, the approved-hash guard (D4), one open revision at a time (D5), overflow (uint8 revision cap with an explicit error, checked uint16 version), no owner, admin or upgrade path, zero-address checks, 6-decimal USDC only (no native-balance mixing), and the deploy script's Arc-only chain guard.

| ID | Severity | Finding | Status |
|---|---|---|---|
| C-1 | Info | USDC sent to the contract with a plain ERC-20 `transfer` is stuck forever, because there is deliberately no withdraw. Native transfers revert (no `receive`). | Accepted (no-custody design). Nothing in the app sends to the contract. |
| C-2 | Low | Anyone can create a project naming any wallet as the client (≈ $0.003 each on mainnet), so a client's dashboard can be spammed. No money is at risk: the client must approve an allowance and press Pay. | Accepted for now. Mockup v4's "accept" step would hide unaccepted projects. |
| C-3 | Info | `previewURI` and `fileHash` are whatever the editor submits. The app only plays `http(s)` previews, and the final file is checked against the hash in the browser before saving. | OK. See W-1 for the server side. |
| C-4 | Info | If either wallet gets blocklisted on Arc, payments revert and no USDC moves (fork test with Arc's blocklist). | OK |

## Web app and API

Checked: Sign-In with Ethereum (domain from the real `Host`, single-use nonce, chain id, expiry, ERC-6492 for smart wallets), HMAC session cookies (`httpOnly`, `secure`, `SameSite=Lax`, chain-bound), JSON-only bodies on writes (no cross-site form posts), a guard on every project route that reads roles from the contract, Supabase only from the server with the service key (RLS on, no policies, so the anon key can do nothing), a private `finals` bucket released only through 60-second signed links after `isPaid`, the `previews` bucket limited to video types and 50 MB, text sanitising, and the read-only RPC relay.

| ID | Severity | Finding | Status |
|---|---|---|---|
| W-1 | **Medium** | **The final file isn't verified on the server before payment.** The upload route records the SHA-256 the editor's browser reports but never checks the stored bytes. A dishonest editor could put the real file's hash on Arc and upload something else. The client pays, then the browser's check rejects the download. Promise 2 still holds, since the client never accepts a wrong file, but the USDC has already moved. | **Open. Fix proposed:** after each final upload the server streams the stored file, computes its SHA-256 and marks the row verified. The project page shows "Final file stored and verified", Approve & pay requires it, and downloads serve verified files only. No contract change. |
| W-2 | Low | A signed upload URL stays valid for about 2 hours. One obtained before payment could add a newer row with the same claimed hash after payment, and downloads pick the newest row, so a dishonest editor could hide the good file. | Closed by the W-1 fix (serve only verified rows). |
| W-3 | Low | No rate limits on notes, upload URLs (50 MB each) or the relay. Supabase's free plan has 1 GB of storage in total, and anyone can become an editor for ≈ $0.003, so storage could be filled on purpose. | Open. Mitigation: a per-wallet daily upload quota; Cloudflare R2 for production. |
| W-4 | Low | No browser security headers, so other sites could frame the app (clickjacking). | **Fixed:** `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (`web/next.config.ts`). |
| W-5 | Info | `/api/rpc` relays only reads of Freedit and USDC (11 methods; Multicall3 inner targets checked; no state overrides; ≤ 20 per batch; same-origin browsers only), with no per-IP limit. | Accepted. Worst case is Vercel usage. |
| W-6 | Info | MetaMask's scanner flags every `*.vercel.app` host as a drainer (D25), so users see a warning. | Open: custom domain skipped for now; the redirect is ready in `next.config.ts`. |
| W-7 | Info | The mainnet explorer API answers non-browser clients with a Cloudflare challenge (403); browsers get through. The activity feed falls back to contract state. Contract verification therefore goes through Sourcify (which lists Arc Mainnet, chain 5042) instead of the explorer API. | Handled. |

## Mainnet deploy notes

- The deploy is the deployer's first mainnet transaction (nonce 0), the same as on testnet, so Freedit lands at **the same address as on testnet**, `0xC82aB1b65866b43A0F3794ba6d5EAC0a55df4895`. Send nothing **from** the deployer before the deploy, or the address changes (harmless, but the docs would need updating).
- The deployer has no powers in the contract; it only pays deploy gas.
- After the deploy: record the address and block in `web/src/lib/network.ts` (mainnet), set Vercel `NEXT_PUBLIC_ARC_NETWORK=mainnet`, redeploy, and run `rpc-relay.mjs` against the live site.
