# STATUS

_Last updated: 2026-10-12. **Phase 1 (contract + tests) is done**: 41/41 tests pass, including the Arc Testnet fork. A1–A5 done. Next: Phase 2 (testnet deploy), which YOU run now._

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

## Next
1. **Phase 2: testnet deploy** (as soon as A4 + A5 are done). YOU run this in the Ubuntu terminal; it asks for the keystore password:
   ```bash
   cd /mnt/c/Users/athar/Documents/DEV/freedit/contracts
   arc-forge script script/Deploy.s.sol --rpc-url arc_testnet --account deployer --broadcast \
     --verify --verifier blockscout --verifier-url https://explorer.testnet.arc.io/api/
   ```
   Then paste me the `Freedit:` address line. ME: record it in CLAUDE.md and check verification on the explorer.
2. Phase 3: frontend, after you approve the mockups and the two extra packages.

## Blockers
- Phase 3 needs mockup approval + OK on `@tanstack/react-query` and `@noble/hashes`.
- Schedule: about 1 day behind the Oct 11 plan. Critical path: A4/A5 → testnet deploy, and A6 (mainnet USDC).

## YOU: actions pending
- [ ] YOU: delete the old OneDrive copy `C:\Users\athar\OneDrive\Documents\CLAUDE\ARC\freedit` once you've confirmed the DEV folder opens fine (it was identical on 10-12, and keeping two copies invites edits to the wrong one)
- [x] A1–A5 done 10-12 (wallets, keystore `deployer`, faucet). Addresses below.
- [ ] YOU: Phase 2 testnet deploy (command under Next)
- [ ] YOU: A6–A7 (mainnet USDC from India, then split it): start today
- [ ] YOU: B9–B13 (GitHub, X, DoraHacks, Vercel, Supabase)
- [ ] YOU: B15 (demo video files: 3 versions, preview + full, each under 50 MB)
- [ ] YOU: OK `@tanstack/react-query` and `@noble/hashes` (SETUP B8)
- [ ] YOU: review `docs/mockups/index.html` and approve it, or tell me what to change

## Addresses (public)
| Role | Address |
|---|---|
| deployer | `0x1037729af7ccCFFD038005acA26aaa2F5DAA0866` |
| Freedit Editor (demo) | `0xa8AeBCFB34a669BFF1127D10f97C36C5d992fB8B` |
| Freedit Client (demo) | `0x2C1c06E6Cf809Ce06eDC383dAe97BF15fe5986De` |

Checked 10-12 (read-only): checksums valid, all plain wallets (EOAs, so Memo works later), none blocklisted, nonce 0.
Testnet: $20.00 each. Mainnet: $0.00 each (waiting on A6).
