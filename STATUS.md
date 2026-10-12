# STATUS

_Last updated: 2026-10-12. **Phases 1–4 are done.** Contract live and verified on Arc Testnet (`0xC82aB1b65866b43A0F3794ba6d5EAC0a55df4895`); website live at **https://freedit-one.vercel.app** (testnet) with Supabase storage, sign-in, uploads and verified downloads. Next: Phase 5 (YOU run the full flow on the live site with your real wallets), then the security review and the mainnet deploy, which needs mainnet USDC (still $0)._

## Done
- Read and verified the Arc docs: chain IDs, RPCs, USDC address and decimals, 20 gwei floor, zero-address rule, Memo, Arc Foundry install (see CLAUDE.md → Arc facts)
- `SETUP.md` checklist (A1–A11, B1–B16)
- `contracts/src/Freedit.sol`: the contract, no custody, no admin
- Tests: 35 unit/fuzz, 3 invariants (zero custody, exact editor income, conservation), 3 Arc-fork tests (decimals, full flow with real USDC, blocklisted editor)
- `contracts/script/Deploy.s.sol` (refuses non-Arc chains)
- `CLAUDE.md` (Arc facts, design, decisions), `.gitignore`
- `docs/mockups/` wireframes for all 7 pages (for approval)
- **10-12** Environment checked: project at `C:\Users\athar\Documents\DEV\freedit` (outside OneDrive), Git 2.56 with identity set, Node 24.20, WSL 2 Ubuntu, Arc Foundry v0.8.0-2 (`arc-forge 1.7.1-dev`) in `~/.local/bin`
- **10-12** `git init` on `main`, baseline commit, `.gitattributes` (LF everywhere)
- **10-12** `arc-forge soldeer install` (forge-std 1.16.2, OpenZeppelin 5.6.1) → `soldeer.lock` committed
- **10-12** `arc-forge build`: clean (one lint note on a test mock, intentional)
- **10-12** `arc-forge test`: **38/38 pass**. `ARC_FORK=true` fork tests: **3/3 pass**
- **10-12** Fixed a silent test gap: the fork tests need `network = "arc"` in `foundry.toml` (now set). Without it the real USDC transfer reverted for an unrelated reason, and the blocklist test passed anyway because it accepted any revert. It now matches Arc's exact `"Blocked address"` reason, and a negative control proves it fails when Arc mode is off. See CLAUDE.md D14.
- **10-12** Deploy script dry run on Arc Testnet: works, ≈2.0M gas ≈ $0.10 USDC. Nothing broadcast.
- **10-12** Mainnet explorer `https://explorer.arc.io/api` probed: live Blockscout, same API as testnet
- **10-12** Circle docs MCP (`circle`) answers; it's configured in WSL Claude Code only
- **10-12 Phase 2: testnet deploy.** YOU ran it. Freedit at [`0xC82aB1b65866b43A0F3794ba6d5EAC0a55df4895`](https://explorer.testnet.arc.io/address/0xC82aB1b65866b43A0F3794ba6d5EAC0a55df4895), tx `0x895f…ae68`, block 66796009, 1,552,079 gas = $0.0504. Checked independently: sender is our deployer, `usdc()` = `0x3600…0000`, `projectCount` = 0, holds $0, runtime size matches the local build (6,891 bytes), explorer shows verified source (0.8.30, 10,000 runs, prague, 12 functions). Broadcast record committed under `contracts/broadcast/`.

- **10-12** Mockups v2 (light + dark) and v3 (heldby-inspired editorial landing, own identity) → **approved**. Headline B, blue brand, keep "Not an escrow".
- **10-12 Phase 3: web app** in `web/` (Next 16.3.8, React 19.2, wagmi 3.7.7, viem 2.56.9, react-query 5.104.0, @noble/hashes 2.4.0, Tailwind 4.3.3, TS 5.9.3; exact pins, each ≥ 14 days old except Next 16.3.8, a security patch; `npm audit`: 0 vulnerabilities). ESLint dropped (not in the brief); checks are `tsc` + `next build`.
  - Pages: `/` landing (v3), `/dashboard`, `/new`, `/p/[id]` (review / request changes / approve & pay / paid + receipt), `/p/[id]/upload`, `/r/[tx]` public receipt. Light/dark with no flash, phone layouts.
  - Wallet: injected + EIP-6963 (MetaMask, Rabby…), wrong-network switch (adds Arc to the wallet), "no wallet found" hint.
  - Writes: simulate → Arc-safe fees (maxFee ≥ 2×20 gwei + tip) → wait 1 confirmation; **exact-amount** USDC approvals; contract errors shown in plain English.
  - **Tested end to end on a local arc-anvil fork of testnet** with two test wallets: create → V1 → free revision → V2 → paid $15 revision (allowance + fee) → V3 → approve & pay $200 (allowance + pay) → receipt. On-chain after: contract $0.00, editor +$215.00, client −$215.00, leftover allowance 0, dashboards show Earned $215.00. Fingerprint: app's chunked SHA-256 = WebCrypto on a 20 MB file; "check a file" accepts V3, rejects V2. Old-version view disables Approve (D4 in the UI).
  - Found and fixed while testing: explorer API rate-limits (429), so activity loads once per state change, never on a timer; reverts aren't retried; "doesn't exist" message for unknown projects; app-bar overlap on narrow screens; dev test wallets excluded from builds when `NEXT_PUBLIC_ARC_NETWORK` is set.

- **10-12 Sharing with the client** (after your question): New project has "Your name"; the project page has a "Share with your client" card with a link carrying the title and both names; Upload V1 confirms the project is already on the client's dashboard; client-only wallets see "Paid to editors / Waiting on the editor". Fixed: the activity list could miss an event the explorer hadn't indexed yet (now re-checks while it's behind the contract). Demoed on the local fork: the client's dashboard lists the project with no link at all; opening the link adds the labels.
- **10-12 Mockup v4 (screens 8–10, for approval):** choose client/editor after connecting; the client can request a project with a link; the editor accepts it. No contract change.

- **10-12 Phase 4 code (Supabase), waiting on keys:** `supabase/schema.sql` (tables, buckets, RLS); server API routes for Sign-In with Ethereum, labels, notes, uploads, downloads (`web/src/server`, `web/src/app/api`); upload page uploads both files with progress; paid page downloads, checks the fingerprint, then saves; notes and titles shared between both sides. Without Supabase keys the app keeps working the Phase 3 way. Checked: tsc, `next build`, 11/11 sign-in attack tests (after fixing a reusable-nonce bug), no server code or keys in browser bundles. `web/.env.local` created (gitignored) with a generated session secret; Supabase lines blank for you.

- **10-12 Supabase project created** through the connector: `freedit`, ref `jqnajstukifkmictupnm`, region ap-south-1 (Mumbai), org "AD-2-17's Org", free plan ($0/month). Schema applied as migration `freedit_initial_schema`: 4 tables (RLS on, no policies), buckets `previews` (public) and `finals` (private), 50 MB each. Security advisor: only the expected INFO "RLS enabled, no policy" (intentional: server-only access). `SUPABASE_URL` written to `web/.env.local`; the service-role key is still blank (YOU).
- **10-12 Phase 4 tested end to end** (local Arc fork + real Supabase, two test wallets): SIWE sign-in → create project → labels saved → V1 upload (final private + preview public, progress shown) → client change request, note stored server-side → editor on a "fresh device" (no local data) sees the client name and, after signing in, the note → V2 upload → client pays → download = V2 final (not V1), fingerprint matches Arc. Storage: preview public 200, final via public/direct URL 400. Access tests 20/20 (stranger/client/editor, before and after payment) + SIWE attack tests 11/11: scripts in `web/scripts/security/` (run against `npm run dev`). Disconnect signs out. Test data removed afterwards (Supabase back to 0 rows, 0 files). Live site checks: all pages 200, `storage:true`, no test wallets or service key in the bundle.
- **10-12 Vercel:** https://freedit-one.vercel.app (root `web`, testnet). Auto-deploys on every push to `main`.
- **10-12 GitHub:** pushed to https://github.com/AD-2-17/FREEDIT (public, branch `main`). Full-history secret scan before pushing: clean. Commits keep your Gmail address (your choice).

- **10-12 Bugs from your first live test.** (1) **MetaMask warning on connect:** MetaMask’s site scanner flags every `*.vercel.app` address as a "wallet drainer" (BLOCK, CRITICAL), including names nobody uses; custom domains come back clean. Fix = own domain (SETUP B12c), and the vercel.app address then forwards to it automatically (`next.config.ts`, tested on a production build). Also: the "add network" prompt now uses the registry name "Arc Network Testnet", so MetaMask doesn’t flag a name mismatch. (2) **"HTTP" error after sign-in on Create project:** not reproducible with a plain test wallet on the live site (connect, sign-in, simulation and the wallet’s confirm step all work; your sign-in at 13:45 UTC reached the server fine). Likely cause found afterwards: when the wallet can’t reach Arc through the RPC URL saved in MetaMask, it answers code -32603 and viem reports that as a contract “revert” whose reason is the wallet’s text (e.g. “RPC endpoint returned HTTP client error.”), which the page showed raw. Arc’s RPC itself answers MetaMask-style requests fine. Now the page says “Your wallet couldn’t reach Arc Testnet … check the RPC URL is https://rpc.testnet.arc.io”. Errors also say which step failed ("Signing in didn’t work: …"), split "couldn’t reach Arc" from "your wallet couldn’t reach Arc", keep the technical detail, and log the full error to the console as `[freedit]`.

## Next
0. **YOU: custom domain (SETUP B12c)**, then tell me the domain. Until then MetaMask shows a red warning on the live site.
1. **YOU: Phase 5, full flow on the live site** (about 20 min): https://freedit-one.vercel.app in two Chrome profiles (Editor, Client), Arc Testnet. Editor: Connect → New project (client = your Client address, price 5, 1 free revision, fee 1) → Upload V1 (a real short MP4 for the preview + any final file, each ≤ 50 MB) → Copy link for your client. Client: Connect → Projects (it's listed) → watch → Request changes (note) → Editor uploads V2 → Client Approve & pay → Download final file. Report anything odd.
2. Decide on mockup v4 (screens 8–10: role choice, client request link, editor accept). Build it only if approved.
3. Phase 6: self security review of the contract and API routes (rerun `web/scripts/security/*.mjs` against `npm run dev`), then YOU say "ok to deploy", then YOU run the mainnet deploy (needs mainnet USDC on the deployer, A6–A7). Then set `freedit` + `deployBlock` for mainnet in `web/src/lib/network.ts`, set Vercel `NEXT_PUBLIC_ARC_NETWORK=mainnet`, redeploy.
4. Phase 7: live example project on mainnet (A11), linked from the landing page and README.
5. Phase 8/9: README (promises, how it works, contract links, limits), favicon, demo video (B15/B16), DoraHacks submission (B11). Deadline **Oct 14, 23:59 US Eastern** (target Oct 13).

## Known limits
- Files up to 50 MB (Supabase free plan). Production path: Cloudflare R2.
- Supabase free projects pause after a week without activity: open the dashboard to wake it.
- Favicon is still Next's default.

## Blockers
- Phase 6 needs mainnet USDC (A6). All three wallets have $0 on mainnet. Exchange withdrawals can take hours, so this is the riskiest item for the deadline.

## YOU: actions pending
- [ ] YOU: delete the old OneDrive copy `C:\Users\athar\OneDrive\Documents\CLAUDE\ARC\freedit` (stale; the real repo is `C:\Users\athar\Documents\DEV\freedit`)
- [x] A1–A5 done 10-12 (wallets, keystore `deployer`, faucet). Addresses below.
- [x] Phase 2 testnet deploy, done 10-12
- [ ] YOU: A6–A7 (mainnet USDC from India, then split it)
- [x] GitHub, Vercel, Supabase done 10-12
- [ ] YOU: B10 X profile, B11 DoraHacks (check the submission form)
- [ ] YOU: B15 (demo video files: 3 versions, preview + full, each under 50 MB)
- [x] Packages OK'd, mockups v3 approved (10-12)
- [ ] YOU: custom domain (SETUP B12c)
- [ ] YOU: Phase 5 on the live site (see Next)
- [ ] YOU: approve or skip mockup v4

## Addresses (public)
| Role | Address |
|---|---|
| deployer | `0x1037729af7ccCFFD038005acA26aaa2F5DAA0866` |
| Freedit Editor (demo) | `0xa8AeBCFB34a669BFF1127D10f97C36C5d992fB8B` |
| Freedit Client (demo) | `0x2C1c06E6Cf809Ce06eDC383dAe97BF15fe5986De` |

Checked 10-12 (read-only): checksums valid, all plain wallets (EOAs, so Memo works later), none blocklisted, nonce 0.
Testnet: $20.00 each (deployer $19.95 after the deploy). Mainnet: $0.00 each (waiting on A6).
