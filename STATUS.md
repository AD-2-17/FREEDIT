# STATUS

_Last updated: 2026-10-12. **Phase 1 (contract + tests) and Phase 2 (testnet deploy) are done.** Freedit is live and verified on Arc Testnet at `0xC82aB1b65866b43A0F3794ba6d5EAC0a55df4895`. Next: Phase 3 (web app), waiting on mockup approval + package OK._

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

## Next
1. **Phase 3: web app.** Starts as soon as you approve the mockups and the two extra packages. Testnet first (`NEXT_PUBLIC_ARC_NETWORK=testnet`), using the address above.
2. Phase 4: Supabase + Vercel (needs B12/B13 accounts).
3. Phase 5: full flow on testnet with the Editor and Client wallets (A9).
4. Phase 6: security review → your "ok to deploy" → mainnet deploy (needs A6/A7 mainnet USDC; deployer has $0 on mainnet).

## Blockers
- Phase 3 needs mockup approval + OK on `@tanstack/react-query` and `@noble/hashes`.
- Phase 6 needs mainnet USDC (A6). Exchange withdrawals can take hours, so this is the riskiest item for the Oct 13 target.

## YOU: actions pending
- [ ] YOU: delete the old OneDrive copy `C:\Users\athar\OneDrive\Documents\CLAUDE\ARC\freedit` once you've confirmed the DEV folder opens fine (it was identical on 10-12, and keeping two copies invites edits to the wrong one)
- [x] A1–A5 done 10-12 (wallets, keystore `deployer`, faucet). Addresses below.
- [x] Phase 2 testnet deploy, done 10-12
- [ ] YOU: A6–A7 (mainnet USDC from India, then split it): start today
- [ ] YOU: B9–B13 (GitHub, X, DoraHacks, Vercel, Supabase)
- [ ] YOU: B15 (demo video files: 3 versions, preview + full, each under 50 MB)
- [ ] YOU: OK `@tanstack/react-query` and `@noble/hashes` (SETUP B8)
- [ ] YOU: review **v3** of `docs/mockups/index.html` (light + dark; landing redone in a heldby-inspired editorial style, 10-12) and reply "approved", or tell me what to change. Also: headline A or B, keep blue, keep section 6 "Not an escrow"?

## Addresses (public)
| Role | Address |
|---|---|
| deployer | `0x1037729af7ccCFFD038005acA26aaa2F5DAA0866` |
| Freedit Editor (demo) | `0xa8AeBCFB34a669BFF1127D10f97C36C5d992fB8B` |
| Freedit Client (demo) | `0x2C1c06E6Cf809Ce06eDC383dAe97BF15fe5986De` |

Checked 10-12 (read-only): checksums valid, all plain wallets (EOAs, so Memo works later), none blocklisted, nonce 0.
Testnet: $20.00 each (deployer $19.95 after the deploy). Mainnet: $0.00 each (waiting on A6).
