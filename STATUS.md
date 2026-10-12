# STATUS

_Last updated: 2026-10-12. **Phases 1–3 are done**: contract tested, deployed and verified on Arc Testnet (`0xC82aB1b65866b43A0F3794ba6d5EAC0a55df4895`), and the web app (`web/`) works end to end on a local Arc fork. Next: you try it with your real wallets on testnet (Phase 3 check), then Phase 4 (Supabase + Vercel)._

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

## Next
1. **YOU: Phase 3 check on testnet with your real wallets** (steps below, about 15 min).
2. Phase 4: Supabase (preview + final file upload, private download after `isPaid`, titles/notes shared between both sides) + Vercel deploy. Needs B12/B13 accounts.
3. Phase 5: full flow on testnet with your Editor and Client wallets on the deployed site (A9).
4. Phase 6: security review → your "ok to deploy" → mainnet deploy (needs A6/A7 mainnet USDC; deployer has $0 on mainnet).

### Phase 3 check (YOU, Windows PowerShell)
```powershell
cd C:\Users\athar\Documents\DEV\freedit\web
npm run dev
```
Open http://localhost:3000 in the Chrome profile with the **Freedit Editor** wallet → Launch app → Connect → New project (client = your Client address, price 5, fee 1) → Upload V1 (any small video file; preview link: any https .mp4, e.g. `https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4`). Then open the copied project link in the **Freedit Client** profile → Request changes / Approve & pay. Every wallet prompt is on Arc Testnet (test USDC only).

## Known limits (Phase 3, fixed in Phase 4)
- Files aren't stored yet: the editor pastes a preview link, and "Download final file" is off. The fingerprint check works today.
- Titles, client names and change-request notes live in the browser that typed them (the other side sees a note fingerprint). Phase 4 moves them to Supabase.
- Favicon is still Next's default.

## Blockers
- Phase 4 needs Supabase + Vercel accounts (B12, B13).
- Phase 6 needs mainnet USDC (A6). Exchange withdrawals can take hours, so this is the riskiest item for the Oct 13 target.

## YOU: actions pending
- [ ] YOU: delete the old OneDrive copy `C:\Users\athar\OneDrive\Documents\CLAUDE\ARC\freedit` once you've confirmed the DEV folder opens fine (it was identical on 10-12, and keeping two copies invites edits to the wrong one)
- [x] A1–A5 done 10-12 (wallets, keystore `deployer`, faucet). Addresses below.
- [x] Phase 2 testnet deploy, done 10-12
- [ ] YOU: A6–A7 (mainnet USDC from India, then split it): start today
- [ ] YOU: B9–B13 (GitHub, X, DoraHacks, Vercel, Supabase)
- [ ] YOU: B15 (demo video files: 3 versions, preview + full, each under 50 MB)
- [x] Packages OK'd, mockups v3 approved (10-12)
- [ ] YOU: Phase 3 check on testnet (see above)

## Addresses (public)
| Role | Address |
|---|---|
| deployer | `0x1037729af7ccCFFD038005acA26aaa2F5DAA0866` |
| Freedit Editor (demo) | `0xa8AeBCFB34a669BFF1127D10f97C36C5d992fB8B` |
| Freedit Client (demo) | `0x2C1c06E6Cf809Ce06eDC383dAe97BF15fe5986De` |

Checked 10-12 (read-only): checksums valid, all plain wallets (EOAs, so Memo works later), none blocklisted, nonce 0.
Testnet: $20.00 each (deployer $19.95 after the deploy). Mainnet: $0.00 each (waiting on A6).
